/**
 * Phase 0 — backfill `attributes_details[i].attribute_id` for legacy products.
 *
 * Why:
 *   `attributes_details[]` historically only stored {attribute_name,
 *   attribute_values}. The PDP variation picker needs to reconcile each row
 *   with `variant_axes[].attribute_id`. Without an `attribute_id` snapshot,
 *   the frontend helper falls back to the Mongoose-autogen subdoc `_id`
 *   (which is unrelated) and the picker silently renders nothing.
 *
 * What this does:
 *   For each product, walk `attributes_details[]`. For any row that is
 *   missing `attribute_id`, look up the source attribute by `attribute_name`
 *   in the global `attributes` collection and stamp its `_id` into the row.
 *
 * Idempotent: rows that already have `attribute_id` are skipped.
 *   Re-running on a fully-migrated DB is a no-op.
 *
 * Usage:
 *   cd FruitSnacksBackend
 *   NODE_ENV=development npx ts-node-dev --transpile-only src/scripts/backfill-attribute-id.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import ProductModel from "../app/product/product.model";
import AttributeModel from "../app/attribute/attribute.model";

const log = (...args: any[]) => console.log("[backfill-attribute-id]", ...args);

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Missing MONGO_URI in .env");
    process.exit(1);
  }
  await mongoose.connect(uri);
  log("Connected to MongoDB");

  // Load the full attribute pool once and index by name. Trimmed +
  // case-insensitive key so minor admin typos still match.
  const allAttributes = await AttributeModel.find({}).select("_id attribute_name").lean();
  const byName = new Map<string, mongoose.Types.ObjectId>();
  for (const a of allAttributes as any[]) {
    if (a?.attribute_name) {
      byName.set(String(a.attribute_name).trim().toLowerCase(), a._id);
    }
  }
  log(`Loaded ${byName.size} attributes into name index`);

  // Stream products to avoid loading the entire collection at once.
  const cursor = ProductModel.find({
    "attributes_details.0": { $exists: true },
  })
    .select("_id product_name attributes_details")
    .cursor();

  let scanned = 0;
  let updated = 0;
  let rowsFilled = 0;
  let rowsUnmatched = 0;

  for await (const product of cursor as any) {
    scanned++;
    let dirty = false;
    const details = product.attributes_details || [];
    for (const row of details) {
      if (row.attribute_id) continue; // already snapshot — skip
      const key = String(row.attribute_name || "").trim().toLowerCase();
      const match = key ? byName.get(key) : null;
      if (match) {
        row.attribute_id = match;
        dirty = true;
        rowsFilled++;
      } else {
        rowsUnmatched++;
        log(
          `  unmatched: product=${product._id} (${product.product_name}) row="${row.attribute_name}"`,
        );
      }
    }
    if (dirty) {
      // Mongoose tracks subdoc edits; using save() is the simplest path that
      // also triggers any future schema validators.
      await product.save();
      updated++;
      log(`✓ updated product ${product._id} (${product.product_name})`);
    }
  }

  log(`Done. Scanned ${scanned} products, updated ${updated}.`);
  log(`Rows filled: ${rowsFilled}, rows unmatched: ${rowsUnmatched}.`);
  if (rowsUnmatched > 0) {
    log(
      "Unmatched rows kept their existing (empty) attribute_id — owner can re-edit those products in Admin to re-pick the attribute.",
    );
  }
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("[backfill-attribute-id] FAILED:", err);
  process.exit(1);
});
