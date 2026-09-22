/**
 * fix-pos-billing-fields.ts — one-time backfill (2026-09-22).
 *
 * Why: the Admin POS used to send the customer's location with the two billing
 * fields swapped relative to the storefront —
 *
 *     POS (old):        billing_city = division,  billing_state = district
 *     Storefront:       billing_city = zone,      billing_state = city/division
 *
 * The server derives the shipping zone from `billing_state`
 * (see order.recompute.ts → recomputeShippingCost), so on POS orders that field
 * held a value the server could not interpret. The POS has since been fixed to
 * send the storefront's shape, which leaves the historical POS rows as the only
 * place the old semantics survive. Reports or filters that read `billing_state`
 * as "the city" therefore see two different meanings depending on the row's age.
 * This script rewrites the old rows into the current shape.
 *
 * Scope: ONLY `order_source: "admin"` orders created before the fix, and only
 * those that still look swapped. Storefront orders are never touched.
 *
 * Detection: a row is considered swapped when `billing_city` holds a known
 * Bangladeshi DIVISION name (that is where the POS put the division) while
 * `billing_state` does not. We deliberately do NOT rewrite a row we cannot
 * positively identify — leaving a row alone is always safer than guessing, and
 * the script reports every skipped row so nothing is silently ignored.
 *
 * Ambiguity: "Dhaka", "Rajshahi", "Chattogram", "Khulna", "Barishal", "Sylhet",
 * "Rangpur" and "Mymensingh" are BOTH division and district names. When both
 * fields carry the same value the swap is a no-op, so those rows are counted as
 * already-correct rather than rewritten.
 *
 * Idempotent: running twice is a no-op — after the first pass `billing_city` no
 * longer holds a division name, so the rows stop matching the detector.
 *
 * Usage:
 *   cd FruitSnacksBackend
 *   npx ts-node-dev --transpile-only src/scripts/fix-pos-billing-fields.ts          # dry run
 *   npx ts-node-dev --transpile-only src/scripts/fix-pos-billing-fields.ts --apply  # write
 *
 * Always run the dry run first and read the summary. `--apply` is required for
 * any write; without it the script only reports what it would do.
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import OrderModel from "../app/order/order.model";

// The 8 divisions, with the spelling variants seen in this data set.
const DIVISION_NAMES = new Set(
  [
    "Dhaka",
    "Chattogram",
    "Chittagong",
    "Rajshahi",
    "Khulna",
    "Barishal",
    "Barisal",
    "Sylhet",
    "Rangpur",
    "Mymensingh",
  ].map((s) => s.toLowerCase()),
);

const norm = (s: any) => String(s || "").trim();
const isDivision = (s: any) => DIVISION_NAMES.has(norm(s).toLowerCase());

const run = async () => {
  const apply = process.argv.includes("--apply");
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI not set — aborting.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`[fix-pos-billing] connected — mode: ${apply ? "APPLY" : "DRY RUN"}`);

  const orders: any[] = await OrderModel.find({ order_source: "admin" })
    .select("_id invoice_id billing_city billing_state shipping_location createdAt")
    .lean();

  console.log(`[fix-pos-billing] ${orders.length} POS orders found`);

  let swapped = 0;
  let sameValue = 0;
  let alreadyCorrect = 0;
  const skipped: Array<{ invoice: string; city: string; state: string }> = [];
  const ops: any[] = [];

  for (const o of orders) {
    const city = norm(o.billing_city);
    const state = norm(o.billing_state);

    // Nothing to reason about.
    if (!city && !state) {
      skipped.push({ invoice: o.invoice_id, city, state });
      continue;
    }

    // Identical values — swapping changes nothing.
    if (city && city.toLowerCase() === state.toLowerCase()) {
      sameValue++;
      continue;
    }

    // Current (correct) shape: the division/city name is already in
    // billing_state. Nothing to do.
    if (isDivision(state) && !isDivision(city)) {
      alreadyCorrect++;
      continue;
    }

    // Old POS shape: division sits in billing_city. Swap the two.
    if (isDivision(city) && !isDivision(state)) {
      swapped++;
      ops.push({
        updateOne: {
          filter: { _id: o._id },
          update: { $set: { billing_city: state, billing_state: city } },
        },
      });
      continue;
    }

    // Anything else (both look like divisions, or neither does) is not
    // positively identifiable — report it and leave it untouched.
    skipped.push({ invoice: o.invoice_id, city, state });
  }

  console.log("\n────── summary ──────");
  console.log(`swapped (to rewrite) : ${swapped}`);
  console.log(`already correct      : ${alreadyCorrect}`);
  console.log(`identical values     : ${sameValue}`);
  console.log(`skipped (ambiguous)  : ${skipped.length}`);

  if (skipped.length) {
    console.log("\nskipped rows — review these by hand:");
    for (const s of skipped.slice(0, 50)) {
      console.log(`  ${s.invoice}: city="${s.city}" state="${s.state}"`);
    }
    if (skipped.length > 50) {
      console.log(`  …and ${skipped.length - 50} more`);
    }
  }

  if (!apply) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply to write.");
  } else if (ops.length) {
    const res = await OrderModel.bulkWrite(ops);
    console.log(`\nAPPLIED — ${res.modifiedCount} orders updated.`);
  } else {
    console.log("\nAPPLY requested but there was nothing to change.");
  }

  await mongoose.disconnect();
  console.log("[fix-pos-billing] done");
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
