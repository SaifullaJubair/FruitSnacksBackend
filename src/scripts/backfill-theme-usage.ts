/**
 * Theme usage-counter repair.
 *
 * Recomputes `themes.used_in_products` from the actual product collection and
 * re-derives `themes.is_deletable` from it.
 *
 * WHY THIS DRIFTED
 * ----------------
 * `deleteProductServices` used a query-level `ProductModel.deleteOne(filter)`.
 * The counter hooks in product.model.ts are registered on `findOneAndDelete`
 * and on a *document-level* `deleteOne` ({ document: true, query: false }) —
 * neither of which a query-level deleteOne triggers. So every deleted themed
 * product left the counter one too high, permanently. Because
 * `is_deletable` is derived as `used_in_products === 0`, themes that no
 * product actually used stayed pinned as non-deletable.
 *
 * `clearDemoDataServices` deletes demo products one-by-one *specifically so the
 * hooks fire* (see its docblock) — so wiping demo data was the fastest way to
 * inflate the counter. That is exactly what the client hit: "theme shows
 * 6 products use this theme" after the demo data was cleared.
 *
 * The delete path is fixed (findOneAndDelete). This script repairs the docs
 * that drifted before the fix landed.
 *
 * Safe to run repeatedly: it computes absolute truth from a countDocuments()
 * per theme and only writes rows that actually differ.
 *
 * Usage:
 *   cd FruitSnacksBackend
 *   # inspect only — writes nothing (default):
 *   node node_modules/ts-node-dev/lib/bin.js --transpile-only src/scripts/backfill-theme-usage.ts
 *   # actually persist:
 *   node node_modules/ts-node-dev/lib/bin.js --transpile-only src/scripts/backfill-theme-usage.ts --apply
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import ThemeModel from "../app/theme/theme.model";
import ProductModel from "../app/product/product.model";

const log = (...args: any[]) => console.log("[backfill-theme-usage]", ...args);

const APPLY = process.argv.includes("--apply");

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Missing MONGO_URI in .env");
    process.exit(1);
  }
  await mongoose.connect(uri);
  log(`Connected to MongoDB — ${APPLY ? "APPLY (will write)" : "DRY RUN (no writes)"}`);

  const themes = await ThemeModel.find({})
    .select("_id theme_name used_in_products is_deletable")
    .lean();

  let drifted = 0;
  let updated = 0;

  for (const t of themes as any[]) {
    // Absolute truth, not an increment: how many products point here right now.
    const real = await ProductModel.countDocuments({ theme_id: t._id });
    const storedCount = Number(t.used_in_products ?? 0);
    const storedDeletable = Boolean(t.is_deletable);
    const realDeletable = real === 0;

    if (storedCount === real && storedDeletable === realDeletable) continue;

    drifted++;
    log(
      `${t.theme_name}: used_in_products ${storedCount} → ${real}` +
        `, is_deletable ${storedDeletable} → ${realDeletable}`,
    );

    if (APPLY) {
      await ThemeModel.updateOne(
        { _id: t._id },
        { $set: { used_in_products: real, is_deletable: realDeletable } },
      );
      updated++;
    }
  }

  log(
    `Scanned ${themes.length} theme(s), ${drifted} drifted` +
      (APPLY ? `, ${updated} updated.` : `. Re-run with --apply to persist.`),
  );

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("[backfill-theme-usage] FAILED:", err);
  process.exit(1);
});
