/**
 * Phase 0.5 V1 follow-up — backfill trim for existing attributes.
 *
 * Why:
 *   Before Phase 0.5, attribute_name and attribute_slug were saved with
 *   leading/trailing whitespace. Result: "  ওজন   " as the display name and
 *   "--ওজন---" as the URL slug. This script trims both fields plus every
 *   per-value name + slug across the attributes collection.
 *
 * Idempotent: rows already clean are skipped.
 *   Re-running on a fully-trimmed DB is a no-op.
 *
 * Usage:
 *   cd FruitSnacksBackend
 *   NODE_ENV=development npx ts-node-dev --transpile-only src/scripts/backfill-attribute-trim.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import AttributeModel from "../app/attribute/attribute.model";

const log = (...args: any[]) =>
  console.log("[backfill-attribute-trim]", ...args);

const trimSlug = (s: string) => s.trim().replace(/^-+|-+$/g, "");

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Missing MONGO_URI in .env");
    process.exit(1);
  }
  await mongoose.connect(uri);
  log("Connected to MongoDB");

  const cursor = AttributeModel.find({}).cursor();
  let scanned = 0;
  let updated = 0;
  let touchedValueRows = 0;

  for await (const attr of cursor as any) {
    scanned++;
    let dirty = false;

    // Top-level attribute_name + slug.
    if (typeof attr.attribute_name === "string") {
      const trimmed = attr.attribute_name.trim();
      if (trimmed !== attr.attribute_name) {
        attr.attribute_name = trimmed;
        dirty = true;
      }
    }
    if (typeof attr.attribute_slug === "string") {
      const trimmed = trimSlug(attr.attribute_slug);
      if (trimmed !== attr.attribute_slug) {
        attr.attribute_slug = trimmed;
        dirty = true;
      }
    }

    // Per-value.
    for (const row of attr.attribute_values || []) {
      if (typeof row.attribute_value_name === "string") {
        const t = row.attribute_value_name.trim();
        if (t !== row.attribute_value_name) {
          row.attribute_value_name = t;
          touchedValueRows++;
          dirty = true;
        }
      }
      if (typeof row.attribute_value_slug === "string") {
        const t = trimSlug(row.attribute_value_slug);
        if (t !== row.attribute_value_slug) {
          row.attribute_value_slug = t;
          dirty = true;
        }
      }
    }

    if (dirty) {
      await attr.save();
      updated++;
      log(`✓ trimmed attribute ${attr._id} (${attr.attribute_name})`);
    }
  }

  log(
    `Done. Scanned ${scanned} attributes, updated ${updated}. Value rows touched: ${touchedValueRows}.`,
  );
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("[backfill-attribute-trim] FAILED:", err);
  process.exit(1);
});
