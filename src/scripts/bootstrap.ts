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
 *   6. Starter FAQ templates — 6 conventional topics (only on an empty collection).
 *
 * Idempotent: re-running skips anything that already exists. Safe to run twice.
 *
 * --sync-superadmin : DON'T create anything new — instead REFRESH the existing
 *   super-admin role so every permission flag (including ones added after a
 *   schema change) is set to true. Run this after deploying a build that added
 *   new permission flags, so the owner's super-admin keeps full access.
 *
 * .env:
 *   MONGO_URI              (required)
 *   SUPER_ADMIN_PHONE      the login id. Defaults to 01700000000 for demo.
 *   SUPER_ADMIN_PASSWORD   the initial password. Defaults to 123456 for demo.
 *   SUPER_ADMIN_NAME       optional, defaults to "Super Admin"
 *   SUPER_ADMIN_EMAIL      optional
 *
 *   ⚠️ The 01700000000 / 123456 demo fallback is for local testing only —
 *   set real values for a client and change the password after first login.
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
import FaqTemplateModel from "../app/faq_template/faq_template.model";
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

// Demo fallback so the script just works for local testing / a quick demo when
// .env isn't filled in. NEVER ship these to a real client — change the password
// immediately after first login.
const DEMO_PHONE = "01700000000";
const DEMO_PASSWORD = "123456";

// The admin + storefront login forms use react-phone-number-input, which always
// submits E.164 (e.g. "+8801700000000"). Login matches admin_phone exactly, so
// the seeded super-admin MUST be stored in the same E.164 shape — otherwise the
// form sends "+880..." and the DB has a raw "01..." → "Admin Not Found".
// Normalize any reasonable input (01XXXXXXXXX / 8801XXXXXXXXX / +8801XXXXXXXXX).
const toE164BD = (raw: string): string => {
  let p = (raw || "").trim().replace(/[\s-]/g, "");
  if (p.startsWith("+")) return p; // already E.164 (any country)
  if (p.startsWith("880")) return "+" + p; // 8801... → +8801...
  if (p.startsWith("01")) return "+88" + p; // 01... → +8801...
  if (p.startsWith("1") && p.length === 10) return "+880" + p; // 1XXXXXXXXX
  return p; // leave anything else untouched
};

const ensureSuperAdminUser = async (roleId: any): Promise<void> => {
  const phone = toE164BD(process.env.SUPER_ADMIN_PHONE || DEMO_PHONE);
  const password = process.env.SUPER_ADMIN_PASSWORD || DEMO_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME || "Super Admin";
  const email = process.env.SUPER_ADMIN_EMAIL;

  const usingDemo =
    !process.env.SUPER_ADMIN_PHONE || !process.env.SUPER_ADMIN_PASSWORD;
  if (usingDemo) {
    console.warn(
      `⚠️  Using DEMO credentials (phone ${DEMO_PHONE} / password ${DEMO_PASSWORD}). ` +
        "Set SUPER_ADMIN_PHONE + SUPER_ADMIN_PASSWORD in .env for a real client, " +
        "and change the password right after first login.",
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

// Starter FAQ templates so a fresh shop has sensible topic suggestions in the
// admin datalist instead of an empty box. `category` is free-text (these six
// are just the conventional topics); each is global (no category_ids) so it
// suggests for every product. Skipped entirely if ANY template already exists,
// so we never duplicate or fight an owner who curated their own set.
const STARTER_FAQ_TEMPLATES = [
  {
    category: "shelf_life",
    question: "{{product_name}} কতদিন ভালো থাকে?",
    answer:
      "সঠিকভাবে সংরক্ষণ করলে {{product_name}} {{shelf_life}} পর্যন্ত ভালো থাকে।",
  },
  {
    category: "storage",
    question: "কীভাবে সংরক্ষণ করব?",
    answer:
      "ঠান্ডা ও শুকনো জায়গায়, সরাসরি রোদ থেকে দূরে রাখুন। প্যাকেট খোলার পর মুখ ভালোভাবে বন্ধ করে রাখুন।",
  },
  {
    category: "ingredients",
    question: "এতে কী কী উপাদান আছে?",
    answer: "এটি ১০০% প্রাকৃতিক — কোনো কৃত্রিম রং, প্রিজারভেটিভ বা বাড়তি চিনি নেই।",
  },
  {
    category: "usage",
    question: "কীভাবে খাব / ব্যবহার করব?",
    answer:
      "সরাসরি স্ন্যাক্স হিসেবে খেতে পারেন, অথবা পছন্দমতো রেসিপিতে ব্যবহার করতে পারেন।",
  },
  {
    category: "health",
    question: "এটি কি স্বাস্থ্যকর?",
    answer:
      "হ্যাঁ, এতে বাড়তি চিনি নেই এবং ফাইবার বেশি। পরিমাণে নিয়ন্ত্রণ রেখে খাওয়া ভালো।",
  },
  {
    category: "general",
    question: "ডেলিভারিতে কতদিন লাগে?",
    answer:
      "ঢাকার ভেতরে ১–২ কর্মদিবস, ঢাকার বাইরে ২–৪ কর্মদিবসের মধ্যে ডেলিভারি হয়।",
  },
];

const seedFaqTopics = async (): Promise<void> => {
  const count = await FaqTemplateModel.estimatedDocumentCount();
  if (count > 0) {
    console.log(
      `• FAQ templates already exist (${count}) — skipping starter seed.`,
    );
    return;
  }
  await FaqTemplateModel.insertMany(
    STARTER_FAQ_TEMPLATES.map((t) => ({ ...t, is_active: true })),
  );
  console.log(
    `✓ Seeded ${STARTER_FAQ_TEMPLATES.length} starter FAQ templates (topic suggestions).`,
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
      await seedFaqTopics();
      const loginPhone = toE164BD(process.env.SUPER_ADMIN_PHONE || DEMO_PHONE);
      const loginPass = process.env.SUPER_ADMIN_PASSWORD || DEMO_PASSWORD;
      console.log(
        `\n✅ Bootstrap complete.\n   Log in →  phone: ${loginPhone}  |  password: ${loginPass}\n   Then change the password and configure the shop from Admin → Settings.`,
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
