/**
 * Floating-images unification migration.
 *
 * Two idempotent passes:
 *
 * 1) THEME pass — every `themes.floating_assets[]` element gets a stable `id`
 *    (uuid) and an `align` default ("middle") when missing. The id is what a
 *    product-level override (hide/replace) targets, so legacy theme assets MUST
 *    have one before overrides can work.
 *
 * 2) PRODUCT pass — legacy per-product `floating_images[]` (old full-page,
 *    percentage-positioned floats) are converted into the new section-anchored
 *    `floating_overrides.extras[]` so they keep rendering after the full-page
 *    `ProductFloatingImages` component is removed. Mapping:
 *      - section      → "any"  (old floats weren't section-aware; "any" shows
 *                        them across sections, closest to old full-page feel)
 *      - position     ← side  ("left"/"right", default "left")
 *      - align        ← vertical%  ("" / <34 → top is NOT right; we map by band)
 *                        vertical "" (auto) → "middle"; <34 → "top";
 *                        34..66 → "middle"; >66 → "bottom"
 *      - animation    → "float" / "slow" (matches the old hardcoded look)
 *      - size         ← size  ("sm"/"md"/"lg" → same; default "md")
 *      - layer        → dropped (section model has no behind/front; floats sit
 *                        behind section content by default which matches the old
 *                        "behind" majority — "front" floats become normal floats)
 *    The original `floating_images[]` is LEFT IN PLACE (back-compat / rollback);
 *    nothing reads it on the storefront after this migration, but keeping it is
 *    harmless and reversible.
 *
 * Idempotent:
 *   - Theme assets already having a non-empty `id` are skipped.
 *   - Products that already have `floating_overrides.extras` populated are NOT
 *     re-converted (guards against double-import on re-run).
 *
 * Usage:
 *   cd FruitSnacksBackend
 *   node node_modules/ts-node-dev/lib/bin.js --transpile-only src/scripts/backfill-floating-assets.ts
 */

import mongoose from "mongoose";
import { randomUUID } from "crypto";
import dotenv from "dotenv";
dotenv.config();

import ThemeModel from "../app/theme/theme.model";
import ProductModel from "../app/product/product.model";

const log = (...args: any[]) => console.log("[backfill-floating]", ...args);

// vertical% string → align band
const verticalToAlign = (v: any): "top" | "middle" | "bottom" => {
  const n = Number(String(v ?? "").trim());
  if (!Number.isFinite(n)) return "middle"; // "" / auto / junk → middle
  if (n < 34) return "top";
  if (n > 66) return "bottom";
  return "middle";
};

const normSize = (s: any): "xs" | "sm" | "md" | "lg" => {
  const v = String(s || "").toLowerCase();
  if (v === "sm" || v === "md" || v === "lg" || v === "xs") return v as any;
  return "md";
};

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Missing MONGO_URI in .env");
    process.exit(1);
  }
  await mongoose.connect(uri);
  log("Connected to MongoDB");

  // ── Pass 1: theme floating_assets id + align backfill ──────────────────────
  // IMPORTANT: read raw DB docs (NOT Mongoose-hydrated), because the schema's
  // `id: { default: randomUUID }` makes Mongoose synthesize a *fresh* id on every
  // hydration — so a hydrated `a.id` is always truthy even when the DB field is
  // missing, and that synthetic id changes each read (never matches a product
  // override). We must inspect the raw stored value and persist via a positional
  // updateOne so the id is written ONCE and stays stable.
  let themesScanned = 0;
  let themesUpdated = 0;
  let assetsStamped = 0;
  const coll = ThemeModel.collection;
  const rawCursor = coll.find({ "floating_assets.0": { $exists: true } });

  for await (const theme of rawCursor as any) {
    themesScanned++;
    const assets = theme.floating_assets || [];
    let dirty = false;
    for (let i = 0; i < assets.length; i++) {
      const a = assets[i];
      const set: Record<string, any> = {};
      if (!a.id) {
        set[`floating_assets.${i}.id`] = randomUUID();
        assetsStamped++;
      }
      if (!a.align) {
        set[`floating_assets.${i}.align`] = "middle";
      }
      if (Object.keys(set).length) {
        await coll.updateOne({ _id: theme._id }, { $set: set });
        dirty = true;
      }
    }
    if (dirty) {
      themesUpdated++;
      log(`✓ theme ${theme._id} (${theme.theme_name}) — stamped ids/align`);
    }
  }
  log(
    `Theme pass done. Scanned ${themesScanned}, updated ${themesUpdated}, assets stamped ${assetsStamped}.`,
  );

  // ── Pass 2: product floating_images → floating_overrides.extras ────────────
  let prodScanned = 0;
  let prodConverted = 0;
  let prodSkipped = 0;
  let floatsMoved = 0;
  const prodCursor = ProductModel.find({ "floating_images.0": { $exists: true } })
    .select("_id product_name floating_images floating_overrides")
    .cursor();

  for await (const p of prodCursor as any) {
    prodScanned++;
    const legacy = p.floating_images || [];
    if (!legacy.length) continue;

    // Already has section-anchored extras → assume converted; don't double-import.
    const existingExtras = p.floating_overrides?.extras || [];
    if (existingExtras.length > 0) {
      prodSkipped++;
      continue;
    }

    const extras = legacy
      .filter((f: any) => f?.asset_url) // skip empty rows
      .map((f: any) => ({
        id: randomUUID(),
        asset_url: f.asset_url,
        asset_key: f.asset_key || "",
        position: f.side === "right" ? "right" : "left",
        align: verticalToAlign(f.vertical),
        section: "any",
        animation_type: "float",
        animation_speed: "slow",
        size: normSize(f.size),
        opacity: 1,
        hide_on_mobile: true,
      }));

    if (!extras.length) {
      prodSkipped++;
      continue;
    }

    p.floating_overrides = {
      hidden_ids: p.floating_overrides?.hidden_ids || [],
      replacements: p.floating_overrides?.replacements || [],
      extras,
    };
    await p.save();
    prodConverted++;
    floatsMoved += extras.length;
    log(
      `✓ product ${p._id} (${p.product_name}) — moved ${extras.length} float(s) → overrides.extras`,
    );
  }
  log(
    `Product pass done. Scanned ${prodScanned}, converted ${prodConverted}, skipped ${prodSkipped}, floats moved ${floatsMoved}.`,
  );

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("[backfill-floating] FAILED:", err);
  process.exit(1);
});
