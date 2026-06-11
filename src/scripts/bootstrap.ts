/**
 * bootstrap.ts — first-run setup for a FRESH database (client handover).
 *
 * Solves the chicken-and-egg problem: every admin/role endpoint requires a
 * logged-in admin, but a fresh DB has none. This seeds the minimum needed to
 * log in and then drive everything else from the Admin UI:
 *
 *   1. Super-Admin role   — schema-derived (every Boolean permission = true),
 *                           so it NEVER goes stale when flags are added/removed.
 *   2. Super-Admin user   — phone + password from .env, active, linked to (1).
 *   3. Settings doc        — Mongoose defaults + brand-neutral overrides.
 *   4. Authentication doc  — Mongoose defaults (SMS/OTP config placeholder).
 *   5. Page SEO seed        — reuses seedPageSeoService().
 *
 * Idempotent: re-running skips anything that already exists. Safe to run twice.
 *
 * --sync-superadmin : DON'T create anything new — instead REFRESH the existing
 *   super-admin role so every permission flag (including ones added after a
 *   schema change) is set to true. Run this after deploying a build that added
 *   new permission flags, so the owner's super-admin keeps full access.
 *
 * Required .env:
 *   MONGO_URI
 *   SUPER_ADMIN_PHONE      e.g. 01700000000  (the login id)
 *   SUPER_ADMIN_PASSWORD   the initial password (owner changes it after login)
 * Optional .env:
 *   SUPER_ADMIN_NAME       defaults to "Super Admin"
 *   SUPER_ADMIN_EMAIL
 *
 * Usage:
 *   cd FruitSnacksBackend
 *   npm run bootstrap                 # fresh-DB setup
 *   npm run bootstrap -- --sync-superadmin   # refresh super-admin flags only
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
const bcrypt = require("bcryptjs");

import RoleModel from "../app/role/role.model";
import AdminModel from "../app/adminRegLog/admin.model";
import SettingModel from "../app/setting/setting.model";
import AuthenticationModel from "../app/authentication/authentication.model";
import { seedPageSeoService } from "../app/pageSeo/pageSeo.services";

const SUPER_ADMIN_ROLE_NAME = "Super Admin";
const SALT_ROUNDS = 10;

// Derive every boolean permission flag straight from the role schema and set
// it to true. Because we read the schema (not a hardcoded list), adding or
// removing a permission flag later requires ZERO changes here.
const buildAllPermissionsTrue = (): Record<string, boolean> => {
  const flags: Record<string, boolean> = {};
  RoleModel.schema.eachPath((pathName, schemaType: any) => {
    if (schemaType?.instance === "Boolean") {
      flags[pathName] = true;
    }
  });
  return flags;
};

const ensureSuperAdminRole = async (): Promise<any> => {
  const existing = await RoleModel.findOne({ role_name: SUPER_ADMIN_ROLE_NAME });
  if (existing) {
    console.log(`• Super-Admin role already exists (${existing._id}).`);
    return existing;
  }
  const role = await RoleModel.create({
    role_name: SUPER_ADMIN_ROLE_NAME,
    ...buildAllPermissionsTrue(),
  });
  console.log(`✓ Created Super-Admin role (${role._id}).`);
  return role;
};

const ensureSuperAdminUser = async (roleId: any): Promise<void> => {
  const phone = process.env.SUPER_ADMIN_PHONE;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME || "Super Admin";
  const email = process.env.SUPER_ADMIN_EMAIL;

  if (!phone || !password) {
    throw new Error(
      "SUPER_ADMIN_PHONE and SUPER_ADMIN_PASSWORD must be set in .env",
    );
  }

  const existing = await AdminModel.findOne({ admin_phone: phone });
  if (existing) {
    console.log(`• Admin with phone ${phone} already exists — skipping.`);
    return;
  }

  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const admin = await AdminModel.create({
    admin_name: name,
    admin_phone: phone,
    admin_password: hashed,
    admin_status: "active",
    role_id: roleId,
    ...(email ? { admin_email: email } : {}),
  });
  console.log(`✓ Created Super-Admin user ${phone} (${admin._id}).`);
};

const ensureSettingsDoc = async (): Promise<void> => {
  const existing = await SettingModel.findOne({});
  if (existing) {
    console.log("• Settings doc already exists — skipping.");
    return;
  }
  // Mongoose fills every field with its schema default; we only override a few
  // brand-neutral values so a fresh shop doesn't show leftover demo copy.
  await SettingModel.create({
    title: "My Shop",
    currency_code: "BDT",
    currency_symbol: "৳",
    currency_name: "Taka",
  });
  console.log("✓ Created Settings doc (defaults + neutral brand).");
};

const ensureAuthDoc = async (): Promise<void> => {
  const existing = await AuthenticationModel.findOne({});
  if (existing) {
    console.log("• Authentication (SMS/OTP) doc already exists — skipping.");
    return;
  }
  await AuthenticationModel.create({});
  console.log("✓ Created Authentication doc (SMS/OTP placeholder).");
};

const seedPages = async (): Promise<void> => {
  const res = await seedPageSeoService();
  console.log(
    `✓ Page SEO seed — created ${res.created}, skipped ${res.skipped}, total ${res.total}.`,
  );
};

// --sync-superadmin: refresh the existing super-admin role so newly added
// permission flags are turned on (post-schema-change maintenance).
const syncSuperAdmin = async (): Promise<void> => {
  const role = await RoleModel.findOne({ role_name: SUPER_ADMIN_ROLE_NAME });
  if (!role) {
    throw new Error(
      `No "${SUPER_ADMIN_ROLE_NAME}" role found. Run bootstrap (without --sync-superadmin) first.`,
    );
  }
  await RoleModel.updateOne(
    { _id: role._id },
    { $set: buildAllPermissionsTrue() },
  );
  console.log(`✓ Refreshed all permission flags on Super-Admin role (${role._id}).`);
};

const run = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI not set in .env");
    process.exit(1);
  }

  const syncOnly = process.argv.includes("--sync-superadmin");

  await mongoose.connect(uri);
  console.log("Connected to MongoDB.\n");

  try {
    if (syncOnly) {
      console.log("Mode: --sync-superadmin (refresh flags only)\n");
      await syncSuperAdmin();
    } else {
      console.log("Mode: fresh-DB bootstrap\n");
      const role = await ensureSuperAdminRole();
      await ensureSuperAdminUser(role._id);
      await ensureSettingsDoc();
      await ensureAuthDoc();
      await seedPages();
      console.log(
        "\n✅ Bootstrap complete. Log in with SUPER_ADMIN_PHONE / SUPER_ADMIN_PASSWORD, then change the password and configure the shop from Admin → Settings.",
      );
    }
  } catch (err: any) {
    console.error("\n❌ Bootstrap failed:", err?.message || err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected.");
  }
};

run();
