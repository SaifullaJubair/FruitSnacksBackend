/**
 * order.recompute.ts — SERVER-SIDE order total recompute (Phase B, B1).
 *
 * WHY: the placement endpoints (postOrder / postSingleOrder) used to TRUST the
 * client-sent `product_unit_final_price` + `grand_total_amount`. A tampered
 * request could turn a 5000৳ order into 5৳. This module recomputes every price
 * from the DB so the client numbers are never trusted again. Owner decision
 * (2026-05-25): server price ALWAYS wins — we OVERWRITE the client values, we
 * never reject on mismatch.
 *
 * Price source of truth = `resolveProductPrice()` (base + variation), then the
 * campaign layer on top (mirrors the frontend `calculatePrice` in
 * FruitSnacksFrontend/src/utils/helper.js so storefront and server agree).
 *
 * SCOPE (B1): product/variation/campaign prices + coupon discount. Shipping
 * cost is NOT recomputed here — owner deferred it to the delivery-zone work;
 * we keep the client's `shipping_cost` for now. Flash sale is a frontend-only
 * concept today (no backend field) → not handled here; it lands in Phase E via
 * the resolver's extension stubs.
 */

import ProductModel from "../product/product.model";
import VariationModel from "../variation/variation.model";
import CampaignModel from "../campaign/campaign.model";
import CouponModel from "../coupon/coupon.model";
import CouponUsedModel from "../coupon/coupon_used/coupon.used.model";
import SettingModel from "../setting/setting.model";
import { resolveProductPrice } from "../product/product.price.resolver";
import { findActiveFlashForProduct } from "../flashsale/flashsale.services";
import ApiError from "../../errors/ApiError";
import mongoose from "mongoose";

// Mirror of the frontend `calculatePrice` (helper.js) so the customer-facing
// price and the server price are computed identically.
//   percent → base − (base × amount / 100), rounded
//   fixed   → base − amount
const applyCampaign = (
  base: number,
  amount: number,
  type: "fixed" | "percent" | undefined,
): number => {
  if (type === "percent") return Math.round(base - (base * amount) / 100);
  if (type === "fixed") return base - amount;
  return base;
};

export interface RecomputedLine {
  product_id: any;
  variation_id?: any;
  campaign_id?: any;
  product_quantity: number;
  product_main_price: number; // product list price (regular)
  product_main_discount_price: number; // product discount price (0 if none)
  product_unit_price: number; // regular unit price incl. variation
  product_unit_final_price: number; // what buyer pays per unit (after discounts)
  product_grand_total_price: number; // final × quantity
}

export interface RecomputedOrder {
  order_products: RecomputedLine[];
  sub_total_amount: number; // Σ final × qty (pre coupon)
  discount_amount: number; // coupon discount
  shipping_cost: number; // passed through from client (B1 scope)
  grand_total_amount: number; // sub_total − discount + shipping
  /**
   * Phase C3 — advance/partial payment. Set ONLY when the client requested an
   * advance (`advance_amount` + `advance_method` in the request, both validated
   * against the server-side settings). Order is then saved with
   * `payment_method:"cod"` + `advance_amount = X` + `payment_status:"unpaid"`,
   * and the controller separately initiates `advance_method` for the advance
   * amount. On advance-paid the order flips to `payment_status:"partial"`;
   * once delivery confirms COD-rest received it flips to `"paid"`.
   */
  advance_amount?: number;
  advance_method?: "sslcommerz" | "manual_mfs" | "bank_transfer";
}

/**
 * Recompute an order entirely from DB state. Returns server-trusted line items
 * and totals; the caller overwrites the client-sent values with these.
 */
export const recomputeOrderTotals = async (
  requestData: any,
  session?: mongoose.ClientSession,
): Promise<RecomputedOrder> => {
  const clientLines: any[] = requestData?.order_products || [];
  if (clientLines.length === 0) {
    throw new ApiError(400, "Order has no products.");
  }

  const q = <T>(p: mongoose.Query<T, any>) => (session ? p.session(session) : p);

  const lines: RecomputedLine[] = [];
  let sub_total_amount = 0;

  for (const line of clientLines) {
    const product_id = line?.product_id;
    const variation_id = line?.variation_id || undefined;
    const quantity = Math.max(1, Number(line?.product_quantity) || 1);

    const product: any = await q(ProductModel.findById(product_id));
    if (!product) {
      throw new ApiError(400, `Product not found: ${product_id}`);
    }

    // Variation (only when the product is a variation product and one was sent).
    let variation: any = null;
    if (product?.is_variation && variation_id) {
      variation = await q(
        VariationModel.findOne({ _id: variation_id, product_id }),
      );
      if (!variation) {
        throw new ApiError(
          400,
          `Variation not found for product ${product_id}.`,
        );
      }
    }

    // Phase E: flash sale lookup happens HERE so the resolver stays sync.
    const flashSale = await findActiveFlashForProduct(product_id, session);

    // Base price (product / variation discount-aware) — single source of truth.
    const resolved = resolveProductPrice(product, { variation, flashSale });
    let unit_regular = resolved.regular_price;
    let unit_final = resolved.final_price;

    // Phase E: tier pricing — if buying qty meets a tier and the tier price
    // is lower than current final, apply it (best-price-wins for the buyer).
    const tiers: any[] = product?.tier_prices || [];
    if (tiers.length > 0) {
      const sorted = [...tiers]
        .filter((t) => Number(t?.min_qty) > 0 && Number(t?.price) > 0)
        .sort((a, b) => b.min_qty - a.min_qty); // largest qty first
      for (const t of sorted) {
        if (quantity >= Number(t.min_qty) && Number(t.price) < unit_final) {
          unit_final = Number(t.price);
          break;
        }
      }
    }

    // Campaign layer (server-side). Only honor an ACTIVE campaign that actually
    // lists this product — the client cannot fabricate a campaign price.
    if (line?.campaign_id) {
      const campaign: any = await q(CampaignModel.findById(line.campaign_id));
      const cp = campaign?.campaign_products?.find(
        (c: any) => String(c?.campaign_product_id) === String(product_id),
      );
      const campaignActive =
        campaign?.campaign_status === "active" &&
        cp?.campaign_product_status === "active";
      if (campaignActive && typeof cp?.campaign_product_price === "number") {
        unit_final = applyCampaign(
          unit_regular,
          cp.campaign_product_price,
          cp.campaign_price_type,
        );
      }
    }

    if (unit_final < 0) unit_final = 0;

    const grand = unit_final * quantity;
    sub_total_amount += grand;

    lines.push({
      product_id,
      variation_id,
      campaign_id: line?.campaign_id || undefined,
      product_quantity: quantity,
      product_main_price: Number(product?.product_price) || 0,
      product_main_discount_price: Number(product?.product_discount_price) || 0,
      product_unit_price: unit_regular,
      product_unit_final_price: unit_final,
      product_grand_total_price: grand,
    });
  }

  // Coupon (order-level). Validate server-side: exists, active, in date window.
  // Mirrors coupon math (percent capped at coupon_max_amount, fixed flat).
  let discount_amount = 0;
  if (requestData?.coupon_id) {
    const coupon: any = await q(CouponModel.findById(requestData.coupon_id));
    const now = new Date();
    const start = coupon?.coupon_start_date
      ? new Date(coupon.coupon_start_date)
      : null;
    const end = coupon?.coupon_end_date
      ? new Date(coupon.coupon_end_date)
      : null;
    const inWindow =
      (!start || now >= start) && (!end || now <= new Date(end.getTime() + 86400000));

    // Phase E coupon hardening — per-user usage cap + total-available cap.
    // `coupon_use_per_person` = max uses per customer (0 / undefined = unlimited).
    // `coupon_available` = remaining global stock (decremented by handleCouponUsage).
    let usageOk = true;
    if (coupon && requestData?.customer_id) {
      const perPerson = Number(coupon.coupon_use_per_person) || 0;
      if (perPerson > 0) {
        const used: any = await q(
          CouponUsedModel.findOne({
            coupon_id: coupon._id,
            customer_id: requestData.customer_id,
          }),
        );
        if (used && Number(used.used) >= perPerson) usageOk = false;
      }
      if (Number(coupon.coupon_available) <= 0) usageOk = false;
    }
    const couponValid =
      coupon && coupon.coupon_status === "active" && inWindow && usageOk;

    if (couponValid) {
      if (coupon.coupon_type === "percent") {
        let d = Math.round((sub_total_amount * coupon.coupon_amount) / 100);
        if (coupon.coupon_max_amount && d > coupon.coupon_max_amount) {
          d = coupon.coupon_max_amount;
        }
        discount_amount = d;
      } else if (coupon.coupon_type === "fixed") {
        discount_amount = coupon.coupon_amount;
      }
      if (discount_amount > sub_total_amount) discount_amount = sub_total_amount;
    }
  }

  // Shipping: trust client for now (B1 scope — recompute later w/ delivery zone).
  const shipping_cost = Number(requestData?.shipping_cost) || 0;
  const grand_total_amount = sub_total_amount - discount_amount + shipping_cost;

  // ── Phase C3: advance/partial payment ────────────────────────────────────
  // If the client asked for advance, validate it against the settings (enabled
  // + method in the allow-list + amount ≥ min%). Caps the advance at the grand
  // total in case the client overshoots. Result is forwarded so the controller
  // knows to initiate the advance gateway for just `advance_amount`.
  let advance_amount: number | undefined;
  let advance_method:
    | "sslcommerz"
    | "manual_mfs"
    | "bank_transfer"
    | undefined;
  const reqAdvanceAmount = Number(requestData?.advance_amount) || 0;
  const reqAdvanceMethod = requestData?.advance_method as string | undefined;
  if (reqAdvanceAmount > 0 && reqAdvanceMethod) {
    const setting: any = await q(SettingModel.findOne({}));
    if (!setting?.advance_payment_enabled) {
      throw new ApiError(400, "Advance payment is not enabled.");
    }
    const allowed = (setting?.advance_payment_methods || []) as string[];
    if (!allowed.includes(reqAdvanceMethod)) {
      throw new ApiError(
        400,
        `Advance method "${reqAdvanceMethod}" is not allowed.`,
      );
    }
    const minPct = Number(setting?.advance_payment_min_percent) || 0;
    const minAmount = Math.ceil((grand_total_amount * minPct) / 100);
    if (reqAdvanceAmount < minAmount) {
      throw new ApiError(
        400,
        `Advance must be at least ${minPct}% (${minAmount}).`,
      );
    }
    advance_amount = Math.min(reqAdvanceAmount, grand_total_amount);
    advance_method = reqAdvanceMethod as any;
  }

  return {
    order_products: lines,
    sub_total_amount,
    discount_amount,
    shipping_cost,
    grand_total_amount,
    advance_amount,
    advance_method,
  };
};
