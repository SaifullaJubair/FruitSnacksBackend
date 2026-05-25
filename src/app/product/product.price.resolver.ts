/**
 * resolveProductPrice — single source of truth for a product's price.
 *
 * Phase 3 of the variation-attribute-filter feature (PLAN D4). Every place that
 * needs a price — PDP, product filter (price-range + sort), cart, order
 * validation — should call THIS, never recompute price math itself. That keeps
 * the storefront and the backend from ever disagreeing on a price.
 *
 * Wired NOW (D4): final = base + variation delta, where
 *   base  = product_discount_price (if a valid discount) else product_price
 *   delta = the chosen variation's price adjustment
 *
 * The variation supports BOTH models during the additive migration:
 *   - NEW combination row: `variation_price_delta` (added to base).
 *   - LEGACY variation: absolute `variation_discount_price ?? variation_price`
 *     (overrides base entirely — matches the current order.validate.ts logic).
 *
 * Extension points left as stubs for the LATER layers (added INTO this same
 * function in Phase B so the call sites never change): campaign, coupon, offer,
 * flash sale, combo pack. They are accepted in `opts` and currently ignored.
 */

import { IProductInterface } from "./product.interface";
import { IVariationInterface } from "../variation/variation.interface";

export interface ResolvePriceOptions {
  variation?: Partial<IVariationInterface> | null;
  // ── Later layers (Phase B). Accepted now so call sites are stable; unused. ──
  campaign?: any;
  coupon?: any;
  offer?: any;
  flashSale?: any;
  comboPack?: any;
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

  // ── Later layers slot in HERE (Phase B), each adjusting `final_price` ──
  // if (opts.campaign)  final_price = applyCampaign(final_price, opts.campaign);
  // if (opts.flashSale) final_price = applyFlashSale(final_price, opts.flashSale);
  // if (opts.offer)     final_price = applyOffer(final_price, opts.offer);
  // if (opts.coupon)    final_price = applyCoupon(final_price, opts.coupon);
  // if (opts.comboPack) final_price = applyComboPack(final_price, opts.comboPack);

  const has_discount = final_price < regular_price;

  return {
    regular_price,
    discount_price: has_discount ? final_price : null,
    final_price,
    has_discount,
    savings: has_discount ? regular_price - final_price : 0,
  };
};
