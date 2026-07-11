/**
 * fix-pageseo-leather-copy.ts — one-time repair (2026-07-11).
 *
 * Replaces the Page SEO rows still carrying the original leather-shop copy.
 *
 * How they got there: `seedPageSeoService` ran once at deploy and inserted its
 * DEFAULT_PAGES, which still described "Premium Genuine Leather Wallets, Ladies
 * Bags & Belts in Bangladesh" from the shop this codebase was cloned from. So a
 * fruit-snack storefront went live telling every visitor — and Google — that it
 * sells leather goods. The seed skips rows that already exist (it is not an
 * upsert), so fixing the seed alone does not touch a database that already has
 * them; this script does.
 *
 * Only rows whose copy still LOOKS like the leather seed are rewritten. If the
 * shop owner has already edited a page from Admin → Page SEO, their text is left
 * alone — the point is to undo a bad default, not to overwrite anyone's work.
 *
 * Idempotent: a second run finds nothing left to match and does nothing.
 *
 * Usage:
 *   cd FruitSnacksBackend
 *   npx ts-node-dev --transpile-only src/scripts/fix-pageseo-leather-copy.ts --dry
 *   npx ts-node-dev --transpile-only src/scripts/fix-pageseo-leather-copy.ts
 *
 * Run it against the database the site actually serves. --dry prints the exact
 * before/after and writes nothing; run that first.
 *
 * The copy below is FruitSnacks-specific. For a different client, edit it here
 * (or just let them set their own from Admin → Page SEO, which is the normal
 * path — this script exists because the leather text was already live).
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import PageSeoModel from "../app/pageSeo/pageSeo.model";

const DRY = process.argv.includes("--dry");

// A row is "still the leather seed" if its title or description mentions any of
// these. Deliberately broad — every leather-seed string trips at least one.
const LEATHER_MARKERS = [
  "leather",
  "wallet",
  "ladies bag",
  "belt",
  "চামড়া",
  "লেদার",
  "মানিব্যাগ",
  "বেল্ট",
  "লেডিস ব্যাগ",
];

const NEW_COPY: Record<string, { title: string; description: string }> = {
  home: {
    title: "Premium Dried Fruits & Healthy Snacks BD",
    description:
      "১০০% ন্যাচারাল ড্রাই ফ্রুটস ও হেলদি স্ন্যাকস। চিনি ও প্রিজারভেটিভমুক্ত, সারা বাংলাদেশে দ্রুত ক্যাশ অন ডেলিভারি।",
  },
  allProducts: {
    title: "All Products | Dried Fruits & Snacks",
    description:
      "আমাদের সম্পূর্ণ ড্রাই ফ্রুটস ও স্ন্যাকস কালেকশন। ন্যাচারাল, চিনিমুক্ত ও প্রিজারভেটিভমুক্ত — সেরা দামে।",
  },
  allTrending: {
    title: "Trending Snacks | Best Sellers",
    description:
      "বর্তমানে সবচেয়ে জনপ্রিয় ড্রাই ফ্রুটস ও হেলদি স্ন্যাকসগুলো দেখে নিন।",
  },
  newArrival: {
    title: "New Arrivals | Fresh Snacks",
    description:
      "আমাদের স্টকে আসা একদম নতুন ড্রাই ফ্রুটস ও স্ন্যাকস প্রোডাক্টগুলো দেখুন।",
  },
  topProduct: {
    title: "Top Rated Dried Fruits & Snacks",
    description: "সবচেয়ে বেশি বিক্রিত এবং টপ রেটেড ন্যাচারাল স্ন্যাকস।",
  },
  latestProduct: {
    title: "Latest Snacks | Just Launched",
    description: "নতুন এবং এক্সক্লুসিভ সব ড্রাই ফ্রুটস ও হেলদি স্ন্যাকস।",
  },
  aboutUs: {
    title: "About FruitSnacks | Our Story",
    description:
      "ন্যাচারাল ড্রাই ফ্রুটস ও হেলদি স্ন্যাকস সরবরাহে আমরা একটি বিশ্বস্ত নাম। আমাদের গল্প জানুন।",
  },
};

const looksLikeLeather = (row: any): boolean => {
  const haystack = `${row?.title || ""} ${row?.description || ""}`.toLowerCase();
  return LEATHER_MARKERS.some((m) => haystack.includes(m.toLowerCase()));
};

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

  let fixed = 0;
  let alreadyEdited = 0;
  let missing = 0;

  for (const [page_key, copy] of Object.entries(NEW_COPY)) {
    const row: any = await PageSeoModel.findOne({ page_key }).lean();

    if (!row) {
      console.log(`MISS  ${page_key} — no row in DB (seed never ran for it)`);
      missing++;
      continue;
    }

    if (!looksLikeLeather(row)) {
      console.log(
        `SKIP  ${page_key} — already reads "${row.title}" (not the leather seed; left alone)`,
      );
      alreadyEdited++;
      continue;
    }

    console.log(`FIX   ${page_key}`);
    console.log(`        old title: ${row.title}`);
    console.log(`        new title: ${copy.title}`);
    console.log(`        old desc : ${(row.description || "").slice(0, 60)}...`);
    console.log(`        new desc : ${copy.description.slice(0, 60)}...`);

    if (!DRY) {
      await PageSeoModel.updateOne(
        { page_key },
        { $set: { title: copy.title, description: copy.description } },
      );
    }
    fixed++;
    console.log("");
  }

  console.log(
    `\n${DRY ? "Would fix" : "Fixed"}: ${fixed}. Already edited (skipped): ${alreadyEdited}. Missing rows: ${missing}.`,
  );
  if (DRY) console.log("\nDRY RUN — nothing was written. Re-run without --dry to apply.");

  await mongoose.disconnect();
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
