import { Types } from "mongoose";
import { IAdminInterface } from "../adminRegLog/admin.interface";
import { ICouponInterface } from "../coupon/coupon.interface";

export interface IOrderInterface {
  _id?: any;
  invoice_id: string;
  order_status:
    | "pending"
    | "on_hold"
    | "confirmed"
    | "processing"
    | "shipped"
    | "partial_delivered"
    | "delivered"
    | "completed"
    | "cancel"
    | "return"
    | "exchange"
    | "refunded";
  pending_time?: string;
  on_hold_time?: string;
  confirmed_time?: string;
  processing_time?: string;
  shipped_time?: string;
  partial_delivered_time?: string;
  delivered_time?: string;
  completed_time?: string;
  cancel_time?: string;
  return_time?: string;
  exchange_time?: string;
  refunded_time?: string;
  billing_country: string;
  billing_city: string;
  billing_state: string;
  billing_address: string;
  shipping_location: string;
  sub_total_amount: number;
  discount_amount: number;
  shipping_cost: number;
  grand_total_amount: number;
  coupon_id?: Types.ObjectId | ICouponInterface;
  customer_id: Types.ObjectId | IAdminInterface;
  customer_phone: string;
  // S4+S5 Phase 1C — optional. Collected at post-order prompt (guest
  // path). When a guest later registers with the same phone, on OTP
  // verify we backfill user.user_email from the most recent order's
  // customer_email so loyalty/Meta `em` keeps working across the
  // guest→registered transition.
  customer_email?: string;
  order_updated_by?: Types.ObjectId | IAdminInterface;
  tracking_code?: string;
  // D18 BLOCKER 3 — POS walk-in/pickup orders have no Pathao zone; all 4 optional
  pathao_city_id?: number;
  pathao_city_name?: string;
  pathao_zone_id?: number;
  pathao_zone_name?: string;
  pathao_status?: string;
  consignment_id?: string;
  delivery_fee?: number;
  // Multi-courier seam — pathao + steadfast wired; the rest integration-ready.
  courier_type?:
    | "pathao"
    | "steadfast"
    | "redx"
    | "paperfly"
    | "ecourier"
    | "carrybee";
  steadfast_consignment_id?: string;
  steadfast_tracking_code?: string;
  steadfast_status?: string;
  steadfast_tracking_message?: string;
  // Normalized cross-courier phase + raw courier string (audit). Nullable/unused
  // until a 2nd courier lands — the seam avoids a migration then.
  courier_phase?:
    | "booked"
    | "picked"
    | "in_transit"
    | "out_for_delivery"
    | "delivered"
    | "partial_delivered"
    | "returned"
    | "cancelled"
    | "hold"
    | "unknown";
  courier_status_raw?: string;
  // ── Delivery override fields (admin editable) ─────────────────────────────
  // Courier এ পাঠানোর সময় এগুলো থাকলে use হবে, না থাকলে original billing data
  delivery_name?: string; // recipient name override
  delivery_phone?: string; // recipient phone override
  delivery_alt_phone?: string; // alternative phone (Steadfast support করে)
  delivery_address?: string; // address override
  delivery_note?: string; // courier note / delivery instruction
  // ── Stock lifecycle (Phase B) ─────────────────────────────────────────────
  // Stock is decremented at PLACEMENT. When an order is cancelled/returned the
  // stock is added back exactly once; this flag guards against double-restock.
  stock_restored?: boolean;
  // ── Payment (Phase C) ─────────────────────────────────────────────────────
  // payment_method: how the buyer will pay. Defaults to "cod" so any caller
  // that omits this field keeps the pre-Phase-C cash-on-delivery flow.
  // payment_status: the lifecycle of the money. "unpaid" = nothing happened
  // yet (the COD default); "pending" = customer has submitted a trxId we
  // haven't verified; "paid" = confirmed; "failed" = gateway/admin declined
  // (triggers restock + order cancel); "partial" = advance paid, rest COD
  // (Phase C3); "refunded" = money returned to buyer after a cancel/return.
  payment_method?:
    | "cod"
    | "manual_mfs"
    | "sslcommerz"
    | "bank_transfer";
  payment_status?:
    | "unpaid"
    | "pending"
    | "paid"
    | "partial"
    | "failed"
    | "refunded";
  transaction_id?: string; // gateway txn id OR customer-submitted mfs trxId
  paid_amount?: number; // total money actually received (cumulative)
  advance_amount?: number; // pre-paid online portion (Phase C3 partial)
  paid_at?: string;
  // Raw gateway/admin payload stash — keeps audit trail without schema bloat.
  payment_meta?: any;

  // Phase H — VAT/tax amount on this order. Computed server-side as the sum
  // of per-line tax (per-product override beats settings.vat_percentage),
  // applied AFTER discount, BEFORE grand_total_amount.
  vat_amount?: number;

  // ── Phase G3 cart-side redeem (F1b) ───────────────────────────────────────
  // Loyalty points the buyer chose to redeem at checkout. Server clamps to
  // (a) the user's balance and (b) `settings.loyalty_max_redeem_percent` × grand_total.
  // The corresponding currency value goes into `discount_amount`. Persisted so
  // post-commit `moveLoyalty(-points, "order_redeem")` is traceable + so the
  // admin can see the redemption on the order detail page.
  loyalty_redeem_points?: number;
  loyalty_redeem_amount?: number;

  // S4+S5 Phase 1B — server-side guard against duplicate Meta/TikTok
  // Purchase events. Browser layer (localStorage purchased_order_ids)
  // is the first defense; this flag is the ultimate guarantee even
  // when the user clears storage, shares the success-page URL, or
  // visits from a different device.
  meta_purchase_sent?: boolean;
  tiktok_purchase_sent?: boolean;
  // Frontend-generated event_id shared between the browser pixel and the
  // server CAPI call so Meta/TikTok can dedupe the two legs of ONE event.
  // Falls back to `purchase-<orderId>` server-side when absent.
  purchase_event_id?: string;

  // D18 POS fields
  order_source?: "storefront" | "admin";
  admin_manual_discount?: number;
  admin_created_by?: Types.ObjectId | IAdminInterface;
  manual_discount_reason?: string;
  payment_method_note?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // ── Order Unification Phase A (2026-06-11) ─────────────────────────────────
  // Future-ready slots so the SAME orders collection can hold every order kind
  // (regular / offer / pre-order / subscription / wholesale / gift / custom).
  // MOST of these are pure slots with NO wiring yet — the matching feature is
  // built in a later phase. The 5 WIRED-NOW fields are marked [WIRED].
  // Campaign + flash sale are already unified at the order_products line level
  // (campaign_id on each line, flash resolved in recompute) — NOT order_type.
  // ═══════════════════════════════════════════════════════════════════════════

  // [WIRED] Primary nature of the whole order. Default "regular". Mixed carts
  // (one campaign product + one regular) stay "regular" — campaign/flash live
  // line-level, so they are intentionally NOT order_type values.
  order_type?:
    | "regular"
    | "offer"
    | "pre_order"
    | "subscription"
    | "wholesale"
    | "gift"
    | "custom";

  // Promotion reference (Phase B offer-merge uses offer_id; coupon_id already
  // exists above). flash_sale_id intentionally omitted — flash is line-level.
  offer_id?: Types.ObjectId;
  subscription_id?: Types.ObjectId;

  // [WIRED] Currency code stored for future multi-currency / multi-client
  // resale. Default "BDT". Display still uses settings.currency_symbol on FE —
  // this is metadata only, NOT wired into any price math yet.
  currency?: string;
  exchange_rate?: number; // base-currency multiplier; default 1

  // pre_discount_total — sum of original (pre-discount) line prices. Lets an
  // offer/bundle invoice show "Original ৳500 → You paid ৳400". [WIRED at
  // placement so it's populated for every order, used heavily in Phase B.]
  pre_discount_total?: number;

  // ── Gift (slot only — Phase C wires the checkout UI) ──────────────────────
  is_gift?: boolean;
  gift_message?: string;
  gift_wrap_charge?: number;
  gift_recipient_name?: string;

  // ── Pre-order (slot only) ─────────────────────────────────────────────────
  is_pre_order?: boolean;
  expected_delivery_date?: string;
  pre_order_deposit?: number;

  // ── Subscription (slot only) ──────────────────────────────────────────────
  subscription_interval?: "weekly" | "monthly" | "quarterly";
  subscription_cycle?: number;
  next_renewal_date?: string;

  // ── Wholesale / B2B (slot only — tier/group price already in recompute) ───
  is_wholesale?: boolean;
  company_name?: string;
  company_address?: string;
  wholesale_note?: string;

  // ── Audit / ops (WIRED via admin updateOrder PATCH only) ──────────────────
  cancel_reason?: string; // [WIRED] why cancelled (admin-entered)
  return_reason?: string; // [WIRED] why returned
  internal_note?: string; // [WIRED] admin-only note; customer never sees it
  fraud_status?: "low" | "medium" | "high" | "blocked"; // slot only
  fraud_checked?: boolean; // slot only
}

export const orderSearchableField = [
  "invoice_id",
  "order_status",
  "customer_phone",
  "order_source",
  "order_type",
];
