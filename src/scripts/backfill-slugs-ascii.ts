/**
 * Backfill ASCII slugs across all slug-bearing collections.
 *
 * Why: admin's old generateSlug kept literal Bangla characters which broke
 * URL state in the storefront (e.g. `?কালার=লাল` → %E0%A6...). This script
 * regenerates every non-ASCII slug as a phonetic ASCII slug using any-ascii,
 * the same package the product slug already uses.
 *
 * Covered collections / fields:
 *   - attributes:       attribute_slug + attribute_values[].attribute_value_slug
 *   - categories:       category_slug
 *   - brands:           brand_slug
 *   - themes:           theme_slug
 *   - products:         product_slug — SKIPPED here (a dedicated
 *                       backfill-product-slugs.ts script already handles
 *                       products + their slug history. Re-run that one
 *                       separately if needed.)
 *
 * Idempotency: a slug is skipped if it is ALREADY pure ASCII (matches
 * /^[a-z0-9-]+$/). So re-running this script is a safe no-op once everything
 * is migrated. Existing English-only slugs are untouched.
 *
 * Collision handling: within a single collection, if regenerating produces a
 * duplicate slug (e.g. two attributes named "নীল" + "নিল" both → "nila"), we
 * append "-2", "-3", … until the slug is unique within the live collection.
 * The original ObjectId is preserved.
 *
 * Usage:
 *   cd FruitSnacksBackend
 *   NODE_ENV=development npx ts-node-dev --transpile-only src/scripts/backfill-slugs-ascii.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import anyAscii from "../helpers/anyAscii";

import AttributeModel from "../app/attribute/attribute.model";
import CategoryModel from "../app/category/category.model";
import BrandModel from "../app/brand/brand.model";
import ThemeModel from "../app/theme/theme.model";

const log = (...args: any[]) => console.log("[backfill-slugs-ascii]", ...args);

const PURE_ASCII_RE = /^[a-z0-9-]+$/;

const slugify = (input: any): string => {
  if (input === null || input === undefined) return "";
  return anyAscii(String(input))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

// Ensure uniqueness within an existing set of taken slugs. Mutates `taken`.
const uniquify = (base: string, taken: Set<string>): string => {
  if (!base) base = "x"; // ultra-defensive fallback
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  for (let n = 2; n < 10_000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
  throw new Error(`Could not uniquify slug from "${base}"`);
};

// Top-level docs with a single slug field.
async function migrateSimple(
  label: string,
  Model: any,
  nameField: string,
  slugField: string,
) {
  const docs = await Model.find({}).select(`${nameField} ${slugField}`).lean();
  const taken = new Set<string>(
    docs
      .map((d: any) => d?.[slugField])
      .filter((s: any) => typeof s === "string" && PURE_ASCII_RE.test(s)),
  );
  let migrated = 0;
  let skipped = 0;
  for (const d of docs) {
    const current = d?.[slugField];
    if (typeof current === "string" && PURE_ASCII_RE.test(current)) {
      skipped += 1;
      continue;
    }
    const fresh = uniquify(slugify(d?.[nameField] || current || ""), taken);
    await Model.updateOne({ _id: d._id }, { $set: { [slugField]: fresh } });
    migrated += 1;
  }
  log(`${label}: ${migrated} migrated, ${skipped} already ASCII`);
}

// Attributes have BOTH a top-level slug AND a nested attribute_values[].slug.
async function migrateAttributes() {
  const docs = await AttributeModel.find({})
    .select("attribute_name attribute_slug attribute_values")
    .lean();
  const takenTop = new Set<string>(
    docs
      .map((d: any) => d?.attribute_slug)
      .filter((s: any) => typeof s === "string" && PURE_ASCII_RE.test(s)),
  );
  let topMigrated = 0;
  let topSkipped = 0;
  let valuesMigrated = 0;
  let valuesSkipped = 0;
  for (const d of docs) {
    const updates: any = {};

    // Top-level attribute_slug.
    if (
      typeof d?.attribute_slug === "string" &&
      PURE_ASCII_RE.test(d.attribute_slug)
    ) {
      topSkipped += 1;
    } else {
      const fresh = uniquify(
        slugify(d?.attribute_name || d?.attribute_slug || ""),
        takenTop,
      );
      updates.attribute_slug = fresh;
      topMigrated += 1;
    }

    // Nested attribute_values[].attribute_value_slug — unique only WITHIN this
    // attribute (not globally), so a fresh local Set per doc.
    const values = Array.isArray(d?.attribute_values) ? d.attribute_values : [];
    const takenNested = new Set<string>(
      values
        .map((v: any) => v?.attribute_value_slug)
        .filter((s: any) => typeof s === "string" && PURE_ASCII_RE.test(s)),
    );
    const nextValues = values.map((v: any) => {
      const current = v?.attribute_value_slug;
      if (typeof current === "string" && PURE_ASCII_RE.test(current)) {
        valuesSkipped += 1;
        return v;
      }
      const fresh = uniquify(
        slugify(v?.attribute_value_name || current || ""),
        takenNested,
      );
      valuesMigrated += 1;
      return { ...v, attribute_value_slug: fresh };
    });
    if (valuesMigrated || updates.attribute_slug !== undefined) {
      updates.attribute_values = nextValues;
    }

    if (Object.keys(updates).length) {
      await AttributeModel.updateOne({ _id: d._id }, { $set: updates });
    }
  }
  log(
    `attributes: top-level ${topMigrated} migrated / ${topSkipped} ASCII, ` +
      `nested-values ${valuesMigrated} migrated / ${valuesSkipped} ASCII`,
  );
}

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Missing MONGO_URI in .env");
    process.exit(1);
  }
  await mongoose.connect(uri);
  log("Connected:", uri.split("@").pop());

  try {
    await migrateAttributes();
    await migrateSimple("categories", CategoryModel, "category_name", "category_slug");
    await migrateSimple("brands", BrandModel, "brand_name", "brand_slug");
    await migrateSimple("themes", ThemeModel, "theme_name", "theme_slug");
    log("Done. Re-run safely — idempotent.");
  } catch (e) {
    console.error("[backfill-slugs-ascii] failed:", e);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
