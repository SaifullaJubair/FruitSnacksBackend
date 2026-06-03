/**
 * Backfill clean product slugs (Shopify pattern).
 *
 * Before: slugs were `<sanitized-name>-<5-random>` which produces ugly URLs
 * like `-2kq7i` when the name was non-ASCII (Bangla) and got stripped to
 * empty. Now we re-slugify with any-ascii + Shopify-style counter-on-collision.
 *
 *   "প্রিমিয়াম পাঞ্জাবী"   → primium-panjabi
 *   "Premium Wallet"        → premium-wallet         (no random hash)
 *   "Premium Wallet" (2nd)  → premium-wallet-2
 *
 * Every changed slug is pushed onto product_slug_history so old links keep
 * redirecting to the new slug (existing SEO-301 mechanism). Idempotent:
 * products whose current slug already equals slugify(name) are skipped.
 *
 * Usage:
 *   cd FruitSnacksBackend
 *   NODE_ENV=development npx ts-node-dev --transpile-only src/scripts/backfill-product-slugs.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import ProductModel from "../app/product/product.model";
import {
  generateUniqueSlug,
  slugify,
} from "../app/product/product.allId";

const log = (...args: any[]) =>
  console.log("[backfill-product-slugs]", ...args);

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Missing MONGO_URI in .env");
    process.exit(1);
  }
  await mongoose.connect(uri);
  log("Connected to MongoDB");

  const cursor = ProductModel.find({})
    .select("_id product_name product_slug product_slug_history")
    .cursor();

  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  for await (const product of cursor as any) {
    scanned++;
    const base = slugify(product.product_name || "");
    if (!base) {
      log(`  skip ${product._id} — name slugifies to empty (purely emoji?)`);
      skipped++;
      continue;
    }

    // Already clean? Either exactly the base slug or base-N.
    const isClean =
      product.product_slug === base ||
      new RegExp(`^${base}-\\d+$`).test(product.product_slug);
    if (isClean) {
      skipped++;
      continue;
    }

    const newSlug = await generateUniqueSlug(
      product.product_name,
      product._id.toString(),
    );
    if (newSlug === product.product_slug) {
      skipped++;
      continue;
    }

    // Push old slug into history so old URLs still 301 to the new one.
    const history: string[] = Array.isArray(product.product_slug_history)
      ? product.product_slug_history
      : [];
    if (product.product_slug && !history.includes(product.product_slug)) {
      history.push(product.product_slug);
    }

    product.product_slug = newSlug;
    product.product_slug_history = history;
    await product.save();
    log(
      `✓ ${product._id} (${product.product_name})  →  ${newSlug}  (old kept in history)`,
    );
    updated++;
  }

  log(
    `Done. Scanned ${scanned}, updated ${updated}, already-clean skipped ${skipped}.`,
  );
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("[backfill-product-slugs] FAILED:", err);
  process.exit(1);
});
