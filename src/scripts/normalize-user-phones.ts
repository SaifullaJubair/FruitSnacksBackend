/**
 * normalize-user-phones.ts — one-time backfill (B1, 2026-06-04).
 *
 * Walks every users doc, normalizes `user_phone` via `normalizeBdPhone`, and
 * writes the canonical shape back. Idempotent — running twice is a no-op.
 *
 * Duplicate handling: if two users end up with the same normalized phone,
 * the older doc (`createdAt` ascending) wins; the newer is logged for the
 * owner to merge manually. We DO NOT auto-merge orders, wallets, loyalty
 * points etc. because that's a business decision.
 *
 * Usage (one-off):
 *   cd FruitSnacksBackend
 *   npx ts-node-dev --transpile-only src/scripts/normalize-user-phones.ts
 *
 * The script connects via MONGO_URI from `.env` and exits with a summary.
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import UserModel from "../app/user/user.model";
import { normalizeBdPhone, isBdMobile } from "../utils/phone";

const run = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("[backfill] connected");

  const users: any[] = await UserModel.find({}).select("_id user_phone createdAt").lean();
  console.log(`[backfill] scanning ${users.length} users`);

  let rewritten = 0;
  let alreadyCanonical = 0;
  let foreign = 0;
  const collisions: Array<{ phone: string; winner: string; duplicates: string[] }> = [];

  // Group by normalized phone to detect collisions.
  const byNorm = new Map<string, any[]>();
  for (const u of users) {
    const norm = normalizeBdPhone(u.user_phone);
    if (!byNorm.has(norm)) byNorm.set(norm, []);
    byNorm.get(norm)!.push(u);
  }

  for (const [norm, group] of byNorm) {
    if (group.length > 1) {
      // Collision — sort by createdAt asc, oldest wins.
      group.sort(
        (a, b) =>
          new Date(a.createdAt || 0).getTime() -
          new Date(b.createdAt || 0).getTime(),
      );
      const winner = group[0];
      const dups = group.slice(1);
      collisions.push({
        phone: norm,
        winner: String(winner._id),
        duplicates: dups.map((d) => String(d._id)),
      });
      // Only update the winner's phone. Duplicates flagged for owner.
      if (winner.user_phone !== norm) {
        await UserModel.updateOne({ _id: winner._id }, { user_phone: norm });
        rewritten++;
      } else {
        alreadyCanonical++;
      }
      continue;
    }
    const u = group[0];
    if (u.user_phone === norm) {
      alreadyCanonical++;
      continue;
    }
    // No collision — safe to rewrite.
    if (!isBdMobile(u.user_phone) && !isBdMobile(norm)) {
      foreign++;
      continue;
    }
    await UserModel.updateOne({ _id: u._id }, { user_phone: norm });
    rewritten++;
  }

  console.log("");
  console.log("[backfill] done");
  console.log(`  rewritten:         ${rewritten}`);
  console.log(`  already canonical: ${alreadyCanonical}`);
  console.log(`  foreign / skipped: ${foreign}`);
  console.log(`  collisions:        ${collisions.length}`);

  if (collisions.length > 0) {
    console.log("");
    console.log("[backfill] COLLISIONS — owner must merge manually:");
    for (const c of collisions) {
      console.log(
        `  phone=${c.phone}  winner=${c.winner}  duplicates=[${c.duplicates.join(", ")}]`,
      );
    }
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error("[backfill] failed:", err);
  process.exit(1);
});
