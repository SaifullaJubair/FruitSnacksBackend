/**
 * E20 migration — tick dashboard_show: true on every superadmin role.
 *
 * Run once after deploying E20 code. Safe to re-run (idempotent $set).
 *
 *   npx ts-node scripts/tick-dashboard-show.ts
 *
 * Requirement: MONGO_URI env var set (same as backend .env).
 * Exit 0 on success, non-zero on error.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("MONGO_URI not set — add it to FruitSnacksBackend/.env");
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGO_URI as string);
  console.log("Connected to MongoDB");

  // Tick dashboard_show on every role that has no value yet (null/undefined/false)
  // Owner will decide per-role after deploy; this just ensures superadmin can login.
  // Strategy: set on ALL roles so existing admins aren't locked out.
  // After deploy: revoke from limited-staff roles in Admin → Role Management.
  const db = mongoose.connection.db;
  if (!db) throw new Error("DB not connected");

  const result = await db.collection("roles").updateMany(
    {},
    { $set: { dashboard_show: true } }
  );

  console.log(
    `Updated ${result.modifiedCount} role doc(s). dashboard_show set to true.`
  );
  console.log(
    "ACTION: After deploy, visit Admin → Role Management and revoke dashboard_show from warehouse/limited roles."
  );

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
