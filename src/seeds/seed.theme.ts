/**
 * Seed: Neutral Default Theme + permission backfill
 *
 * Run once after the new schema is deployed (or manually via:
 *   npx ts-node src/seeds/seed.theme.ts
 * with MONGO_URI set in env).
 *
 * 1. Inserts a "Neutral Default" theme if none exists with that slug.
 * 2. Adds the new theme and faq_template permission flags to every role
 *    (defaults false; super-admin role gets true if it can be detected
 *    by name containing "super").
 */
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import ThemeModel from "../app/theme/theme.model";
import RoleModel from "../app/role/role.model";
import { generateThemeColors } from "../helpers/theme.color.gen";

async function seedNeutralTheme() {
  const slug = "neutral-default";
  const exists = await ThemeModel.findOne({ theme_slug: slug }).lean();
  if (exists) {
    console.log("[seed] Neutral default theme already exists, skipping.");
    return exists;
  }

  const colors = generateThemeColors("#10B981", "#FAFAFA", "#F59E0B"); // greenish primary
  const created = await ThemeModel.create({
    theme_name: "Neutral Default",
    theme_slug: slug,
    theme_for: "default",
    status: "active",
    preview_approved: true,
    colors,
    floating_assets: [],
    typography: {
      font_key: "hind-siliguri",
      heading_weight: "700",
      style: "rounded",
    },
    button_style: { border_radius: "8px", variant: "filled" },
  });
  console.log("[seed] Created Neutral Default theme:", created._id);
  return created;
}

const NEW_PERMS = [
  "theme_show",
  "theme_create",
  "theme_update",
  "theme_delete",
  "faq_template_show",
  "faq_template_create",
  "faq_template_update",
  "faq_template_delete",
] as const;

async function backfillPermissions() {
  const roles = await RoleModel.find({}).lean();
  for (const r of roles) {
    const update: any = {};
    const isSuper = (r.role_name || "").toLowerCase().includes("super");
    for (const p of NEW_PERMS) {
      if ((r as any)[p] === undefined) {
        update[p] = isSuper;
      }
    }
    if (Object.keys(update).length) {
      await RoleModel.updateOne({ _id: r._id }, update);
      console.log(`[seed] Updated role ${r.role_name} with`, Object.keys(update).join(", "));
    }
  }
}

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("[seed] Connected to MongoDB");
  try {
    await seedNeutralTheme();
    await backfillPermissions();
  } catch (e) {
    console.error("[seed] Failed:", e);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("[seed] Disconnected");
  }
})();
