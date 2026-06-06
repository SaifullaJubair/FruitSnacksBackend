/**
 * zero-product-qty-when-variation.ts — one-time migration (A2, 2026-06-04).
 *
 * Owner-locked rule (sprint A2): when a product has variations, the variation
 * stock sum IS the authoritative stock. The legacy product-level
 * `product_quantity` becomes ambiguous noise. This script zeroes it out for
 * every product flagged `is_variation: true`, so the admin list page can
 * trust the variation sum unconditionally.
 *
 * Simple (non-variation) products are NOT touched.
 *
 * Idempotent — running twice is a no-op (only writes when current value is
 * non-zero).
 *
 * Usage (one-off, on deploy):
 *   cd FruitSnacksBackend
 *   npx ts-node-dev --transpile-only src/scripts/zero-product-qty-when-variation.ts
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import ProductModel from "../app/product/product.model";

const run = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("[migrate] connected");

  const candidates = await ProductModel.find({
    is_variation: true,
    product_quantity: { $gt: 0 },
  })
    .select("_id product_name product_quantity")
    .lean();

  console.log(`[migrate] ${candidates.length} variation products with non-zero product_quantity`);

  if (candidates.length === 0) {
    console.log("[migrate] nothing to do");
    await mongoose.disconnect();
    process.exit(0);
  }

  const result = await ProductModel.updateMany(
    { is_variation: true, product_quantity: { $gt: 0 } },
    { $set: { product_quantity: 0 } },
  );

  console.log("[migrate] done");
  console.log(`  matched:  ${result.matchedCount}`);
  console.log(`  modified: ${result.modifiedCount}`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
