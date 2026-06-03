/**
 * Phase A — backfill `display_type` (and `tracks_weight: false`) for legacy
 * attribute docs.
 *
 * Why:
 *   Phase A adds `display_type: "swatch" | "button" | "dropdown"` to the
 *   attribute schema. Existing docs have no value → schema default ("button")
 *   would kick in, but PDP currently renders color attributes as swatches via
 *   an implicit `isHexColor()` check on attribute_value_code. Defaulting
 *   everything to "button" would regress the storefront between Phase A ship
 *   and Phase C ship (Phase C is the PDP picker rewrite that consumes
 *   display_type).
 *
 *   Smart default (MOD #1):
 *     - any value has a hex-like attribute_value_code  →  "swatch"
 *     - otherwise                                       →  "button"
 *   Logged per attribute so owner can review.
 *
 * Race safety (MOD #9):
 *   Uses findOneAndUpdate with `display_type: { $exists: false }` filter so
 *   admin mid-migration manual flips are NEVER stomped. Idempotent — re-run
 *   on a fully migrated DB is a no-op.
 *
 * Usage:
 *   cd FruitSnacksBackend
 *   NODE_ENV=development npx ts-node-dev --transpile-only src/scripts/backfill-attribute-display-type.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import AttributeModel from "../app/attribute/attribute.model";

const log = (...args: any[]) =>
  console.log("[backfill-attribute-display-type]", ...args);

// Matches: "#fff", "#FFFFFF", "FFF", "ffffff", "#ff0000aa" (8-char alpha).
// Loose so it catches both with-and-without leading-#, 3/4/6/8 hex chars.
const HEX_RE = /^#?[A-Fa-f0-9]{3,8}$/;

const looksLikeHex = (s: any): boolean =>
  typeof s === "string" && s.length > 0 && HEX_RE.test(s.trim());

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Missing MONGO_URI in .env");
    process.exit(1);
  }
  await mongoose.connect(uri);
  log("Connected to MongoDB");

  // Find only docs that DON'T have display_type yet — race-safe per MOD #9.
  // Admin's in-flight edits already write display_type, so they get skipped.
  const cursor = AttributeModel.find({
    display_type: { $exists: false },
  })
    .select("_id attribute_name attribute_values display_type")
    .cursor();

  let scanned = 0;
  let swatched = 0;
  let buttoned = 0;
  let skipped = 0; // race-loser: another writer set display_type after our find

  for await (const attr of cursor as any) {
    scanned++;
    const hasHex = (attr.attribute_values || []).some((v: any) =>
      looksLikeHex(v?.attribute_value_code),
    );
    const nextDisplay = hasHex ? "swatch" : "button";

    // Race-safe set: only update if display_type is STILL absent. If a
    // concurrent admin save filled it in, leave their choice alone.
    const result = await AttributeModel.findOneAndUpdate(
      { _id: attr._id, display_type: { $exists: false } },
      { $set: { display_type: nextDisplay, tracks_weight: false } },
      { new: false },
    );

    if (!result) {
      skipped++;
      log(`  skip ${attr._id} (${attr.attribute_name}) — concurrent writer won`);
      continue;
    }

    if (nextDisplay === "swatch") {
      swatched++;
      log(
        `✓ swatch  ${attr._id} (${attr.attribute_name}) — has hex on ${(attr.attribute_values || []).filter((v: any) => looksLikeHex(v?.attribute_value_code)).length}/${(attr.attribute_values || []).length} values`,
      );
    } else {
      buttoned++;
      log(`✓ button  ${attr._id} (${attr.attribute_name})`);
    }
  }

  // MOD #10 — log breakdown, not bare count.
  log(
    `\nDone. Found ${scanned} attributes needing migration — migrated ${swatched} as swatch + ${buttoned} as button, skipped ${skipped} (concurrent writer).`,
  );
  if (scanned === 0) {
    log(
      "Empty attribute pool OR all already-migrated — script is idempotent, safe to re-run.",
    );
  }
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("[backfill-attribute-display-type] FAILED:", err);
  process.exit(1);
});
