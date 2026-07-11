/**
 * backfill-variation-price.ts — one-time repair (2026-07-11).
 *
 * Repairs variations saved with `variation_price` of 0 (or missing).
 *
 * How they got that way: the admin's new-product form seeds each variation row's
 * price from the product's base price, but wrote it once, at row-creation time.
 * An admin who generated the variation matrix BEFORE typing the product price
 * therefore saved `variation_price: 0 + delta`, and no later edit to the price
 * corrected it — the form's Final column recomputes from the base price at
 * render, so the screen looked right while the stored value stayed 0.
 *
 * What a stored 0 did on the live storefront:
 *   - printed a bare "0" next to the price on the product page (React renders 0,
 *     unlike null/false, and the strike-through guard was a bare `&&`);
 *   - zeroed the order summary's subtotal while the grand total stayed correct;
 *   - divided by zero into "-Infinity% OFF" in the quick-view modal;
 *   - dropped the product out of every price-range filter, because the filter's
 *     effective_price is $min(variation_price) and 0 satisfies no min_price > 0.
 *
 * Money was never wrong: the server's price resolver treats variation_price <= 0
 * as "not an absolute price" and falls back to product_price + delta, which is
 * what the buyer was charged. This repair makes the stored data say what the
 * resolver already assumed.
 *
 * The fix: variation_price = product_price + variation_price_delta.
 * A discount at or above that price is not a discount, so it is cleared (0)
 * rather than left to strike through a number equal to what the buyer pays.
 *
 * Only variations whose price is <= 0 are touched. Idempotent — a second run is
 * a no-op. Products with no base price are skipped and reported: there is
 * nothing to derive a price from, and inventing one is the admin's call.
 *
 * Usage:
 *   cd FruitSnacksBackend
 *   npx ts-node-dev --transpile-only src/scripts/backfill-variation-price.ts --dry
 *   npx ts-node-dev --transpile-only src/scripts/backfill-variation-price.ts
 *
 * Run it against the database the site actually serves. --dry prints the exact
 * before/after for every row and writes nothing; run that first.
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import ProductModel from "../app/product/product.model";
import VariationModel from "../app/variation/variation.model";

const DRY = process.argv.includes("--dry");

const run = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(
    `Connected. Mode: ${DRY ? "DRY RUN (no writes)" : "LIVE (writing)"}\n`,
  );

  const broken = await VariationModel.find({
    $or: [
      { variation_price: { $lte: 0 } },
      { variation_price: { $exists: false } },
      { variation_price: null },
    ],
  }).lean();

  if (!broken.length) {
    console.log("No variations with a missing price. Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${broken.length} variation(s) with no price.\n`);

  // Group by product so we read each product once and can report per product.
  const byProduct = new Map<string, any[]>();
  for (const v of broken) {
    const key = String(v.product_id);
    if (!byProduct.has(key)) byProduct.set(key, []);
    byProduct.get(key)!.push(v);
  }

  let fixed = 0;
  let skipped = 0;

  for (const [productId, rows] of byProduct) {
    const product: any = await ProductModel.findById(productId)
      .select("product_name product_slug product_price product_discount_price")
      .lean();

    if (!product) {
      console.log(`SKIP  product ${productId} — not found (orphan variations)`);
      skipped += rows.length;
      continue;
    }

    const basePrice = Number(product.product_price) || 0;
    if (basePrice <= 0) {
      console.log(
        `SKIP  ${product.product_slug} — product_price is ${product.product_price}; ` +
          `nothing to derive a variation price from. Set the product price in Admin, then re-run.`,
      );
      skipped += rows.length;
      continue;
    }

    console.log(`${product.product_slug}  (product_price ${basePrice})`);

    for (const v of rows) {
      const delta = Number(v.variation_price_delta) || 0;
      const newPrice = basePrice + delta;
      const currentDiscount = Number(v.variation_discount_price) || 0;

      // A discount only means something strictly below the regular price.
      const keepDiscount =
        currentDiscount > 0 && currentDiscount < newPrice ? currentDiscount : 0;

      const discountNote =
        keepDiscount === currentDiscount
          ? `discount ${currentDiscount} kept`
          : `discount ${currentDiscount} cleared (>= price ${newPrice})`;

      console.log(
        `   ${v.variation_sku || v.variation_name}: ` +
          `price ${v.variation_price} -> ${newPrice} (delta ${delta}), ${discountNote}`,
      );

      if (!DRY) {
        await VariationModel.updateOne(
          { _id: v._id },
          {
            $set: {
              variation_price: newPrice,
              variation_discount_price: keepDiscount,
            },
          },
        );
      }
      fixed++;
    }
    console.log("");
  }

  console.log(
    `${DRY ? "Would fix" : "Fixed"}: ${fixed} variation(s). Skipped: ${skipped}.`,
  );
  if (DRY) console.log("\nDRY RUN — nothing was written. Re-run without --dry to apply.");

  await mongoose.disconnect();
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
