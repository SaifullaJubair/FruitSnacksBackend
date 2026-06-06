/**
 * resolveProductPrice — UNIT price ONLY (pure, sync, no DB).
 *
 * Layered pricing split (locked 2026-06-05):
 *
 *   Resolver (this file)         | Recompute (order.recompute.ts)
 *   -----------------------------+--------------------------------------------
 *   base product price           | campaign override
 *   variation delta / legacy abs | tier-price (qty)
 *   flash sale (fixed / percent) | customer-group (wholesale / vip)
 *                                | coupon (fixed / percent, caps, BOGO TBD)
 *                                | loyalty redeem
 *                                | VAT (per-line override / settings)
 *                                | shipping (per-line-additive, zone-aware)
 *
 * Why the split: order-context layers need DB lookups + a customer/order
 * scope. The resolver stays pure so PDP / product listing / search ranking
 * can call it without async overhead. Recompute owns everything that depends
 * on cart shape, coupon code, or customer identity.
 *
 * Wired NOW: final = base + variation delta, then flash-sale on top, where
 *   base  = product_discount_price (if a valid discount) else product_price
 *   delta = the chosen variation's price adjustment
 *
 * Variation supports BOTH models during the additive migration:
 *   - NEW combination row: `variation_price_delta` (added to base).
 *   - LEGACY variation: absolute `variation_discount_price ?? variation_price`
 *     (overrides base entirely — matches the current order.validate.ts logic).
 */

import { IProductInterface } from "./product.interface";
import { IVariationInterface } from "../variation/variation.interface";

export interface ResolvePriceOptions {
  variation?: Partial<IVariationInterface> | null;
  flashSale?: any;
}

export interface ResolvedPrice {
  regular_price: number; // the product's list price (pre-discount), incl. variation
  discount_price: number | null; // discounted unit price if any, else null
  final_price: number; // what the buyer actually pays per unit
  has_discount: boolean;
  savings: number; // regular_price - final_price (0 if no discount)
}

// A discount counts only if it is a positive number strictly below the regular
// price. Zero / null / >= regular means "no discount".
const isValidDiscount = (
  discount: number | null | undefined,
  regular: number,
): discount is number =>
  typeof discount === "number" &&
  discount > 0 &&
  discount < regular;

const toNumber = (v: unknown): number =>
  typeof v === "number" && !Number.isNaN(v) ? v : 0;

export const resolveProductPrice = (
  product: Partial<IProductInterface>,
  opts: ResolvePriceOptions = {},
): ResolvedPrice => {
  const { variation } = opts;

  const productRegular = toNumber(product?.product_price);
  const productDiscount = product?.product_discount_price as
    | number
    | null
    | undefined;

  let regular_price: number;
  let final_price: number;

  if (variation) {
    const legacyVariationPrice = variation?.variation_price;
    const legacyVariationDiscount = variation?.variation_discount_price;
    const hasLegacyAbsolute =
      typeof legacyVariationPrice === "number" && legacyVariationPrice > 0;

    if (hasLegacyAbsolute) {
      // LEGACY: variation carries its own absolute price (overrides base).
      regular_price = toNumber(legacyVariationPrice);
      final_price = isValidDiscount(legacyVariationDiscount, regular_price)
        ? (legacyVariationDiscount as number)
        : regular_price;
    } else {
      // NEW combination row: base price + this combination's delta.
      const delta = toNumber(variation?.variation_price_delta);
      regular_price = productRegular + delta;
      final_price = isValidDiscount(productDiscount, productRegular)
        ? (productDiscount as number) + delta
        : regular_price;
    }
  } else {
    // No variation — straight product price.
    regular_price = productRegular;
    final_price = isValidDiscount(productDiscount, productRegular)
      ? (productDiscount as number)
      : productRegular;
  }

  // Flash sale (when active). `flashSale` is fetched by the caller; we just
  // apply the math. `flash_price_type: "fixed"` = absolute price; `"percent"`
  // = % off the current final_price.
  const fs = opts?.flashSale;
  if (fs && typeof fs.flash_price === "number") {
    if (fs.flash_price_type === "percent") {
      final_price = Math.round(final_price - (final_price * fs.flash_price) / 100);
    } else {
      // fixed = absolute target price
      final_price = fs.flash_price;
    }
  }

  const has_discount = final_price < regular_price;

  return {
    regular_price,
    discount_price: has_discount ? final_price : null,
    final_price,
    has_discount,
    savings: has_discount ? regular_price - final_price : 0,
  };
};
