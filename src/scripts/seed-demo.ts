/**
 * seed-demo.ts — populate a fresh DB with a believable FOOD-shop demo so a
 * client sees a presentable shop at handover. Removed later via the Admin
 * "Clear demo data" button (or `--force` re-seed).
 *
 *   npm run seed:demo            # seed (no-op if demo already present)
 *   npm run seed:demo -- --force # clear existing demo, then re-seed
 *
 * Guarantees / edge handling:
 *   • Runs AFTER bootstrap — needs a super-admin for *_publisher_id. Aborts if
 *     none exists.
 *   • Idempotent: if any is_demo product already exists, it skips (unless
 *     --force). So a double-run never duplicates.
 *   • Images first: every S3 image is resolved BEFORE any DB write. If an image
 *     fails we abort before touching the DB (no half-seeded catalog).
 *   • Slug-collision safe: if a demo slug already exists as a NON-demo row
 *     (client built a real product with the same slug), we abort with a clear
 *     message rather than crash on the unique index.
 *   • Auto-rollback: any failure during DB inserts triggers clearDemoData() so
 *     a partial seed is cleaned up.
 *   • Everything stamped is_demo=true (reviews is_seeded=true) → one-click clear.
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";

import AdminModel from "../app/adminRegLog/admin.model";
import CategoryModel from "../app/category/category.model";
import AttributeModel from "../app/attribute/attribute.model";
import BannerModel from "../app/banner/banner.model";
import SliderModel from "../app/slider/slider.model";
import ProductModel from "../app/product/product.model";
import VariationModel from "../app/variation/variation.model";
import ReviewModel from "../app/review/review.model";
import ThemeModel from "../app/theme/theme.model";

import { generateThemeColors } from "../helpers/theme.color.gen";
import { resolveDemoImage } from "../seeds/demo/image";
import {
  DEMO_ATTRIBUTES,
  DEMO_BANNERS,
  DEMO_CATEGORIES,
  DEMO_PRODUCTS,
  DEMO_SLIDERS,
  DEMO_THEME,
  DemoCategory,
  DemoImage,
} from "../seeds/demo/food";
import {
  clearDemoDataServices,
  countDemoDataServices,
} from "../app/demo/demo.services";

const force = process.argv.includes("--force");

// ──────────────────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────────────────

// Resolve every demo image to a permanent S3 URL up front. Returns a map
// keyed by image slug → { Location, Key }. Throws on the first failure so we
// abort before any DB write.
const resolveAllImages = async (): Promise<Map<string, { Location: string; Key: string }>> => {
  const all: DemoImage[] = [];
  DEMO_BANNERS.forEach((b) => all.push(b.image));
  DEMO_SLIDERS.forEach((s) => all.push(s.image));
  DEMO_PRODUCTS.forEach((p) => {
    all.push(p.main_image);
    (p.other_images || []).forEach((i) => all.push(i));
  });
  // Category logos (recurse the nested tree).
  const walkCatImgs = (nodes: DemoCategory[]) =>
    nodes.forEach((n) => {
      if (n.logo) all.push(n.logo);
      if (n.children) walkCatImgs(n.children);
    });
  walkCatImgs(DEMO_CATEGORIES);
  // Theme floating assets.
  (DEMO_THEME.floating || []).forEach((f) => all.push({ slug: f.slug, url: f.url }));

  // De-dup by slug.
  const bySlug = new Map<string, DemoImage>();
  all.forEach((img) => bySlug.set(img.slug, img));

  const out = new Map<string, { Location: string; Key: string }>();
  for (const [slug, img] of bySlug) {
    process.stdout.write(`  • image ${slug} … `);
    const res = await resolveDemoImage(img.url, slug);
    out.set(slug, res);
    console.log("ok");
  }
  return out;
};

// Abort if any demo slug already exists as a real (non-demo) row.
const assertNoSlugCollisions = async (): Promise<void> => {
  const catSlugs: string[] = [];
  const walk = (nodes: DemoCategory[]) =>
    nodes.forEach((n) => {
      catSlugs.push(n.slug);
      if (n.children) walk(n.children);
    });
  walk(DEMO_CATEGORIES);

  const realCat = await CategoryModel.findOne({
    category_slug: { $in: catSlugs },
    is_demo: { $ne: true },
  }).lean();
  if (realCat) {
    throw new Error(
      `Category slug "${(realCat as any).category_slug}" already exists as a non-demo row. ` +
        "Rename it or remove it before seeding demo data.",
    );
  }

  const prodSlugs = DEMO_PRODUCTS.map((p) => p.slug);
  const realProd = await ProductModel.findOne({
    product_slug: { $in: prodSlugs },
    is_demo: { $ne: true },
  }).lean();
  if (realProd) {
    throw new Error(
      `Product slug "${(realProd as any).product_slug}" already exists as a non-demo row. ` +
        "Rename it or remove it before seeding demo data.",
    );
  }
};

// ──────────────────────────────────────────────────────────────────────────
// seed
// ──────────────────────────────────────────────────────────────────────────

const seed = async (publisherId: any, images: Map<string, { Location: string; Key: string }>) => {
  // 1) Theme
  const colors = generateThemeColors(DEMO_THEME.primary, DEMO_THEME.page_bg, DEMO_THEME.accent);
  const floatingAssets = (DEMO_THEME.floating || []).map((f) => {
    const img = images.get(f.slug)!;
    return {
      asset_url: img.Location,
      asset_key: img.Key,
      position: f.position,
      align: f.align,
      section: f.section,
      animation_type: f.animation_type,
      animation_speed: f.animation_speed,
      size: f.size,
      opacity: f.opacity,
    };
  });
  let theme = await ThemeModel.findOne({ theme_slug: DEMO_THEME.theme_slug });
  if (!theme) {
    theme = await ThemeModel.create({
      theme_name: DEMO_THEME.theme_name,
      theme_slug: DEMO_THEME.theme_slug,
      theme_for: DEMO_THEME.theme_for,
      status: "active",
      preview_approved: true,
      is_demo: true,
      colors,
      floating_assets: floatingAssets,
      typography: { font_key: "hind-siliguri", heading_weight: "700" },
      button_style: { border_radius: "10px", variant: "filled" },
      created_by: publisherId,
    });
  } else {
    // Theme survived a previous --force clear (clear KEEPS themes). Refresh its
    // demo visuals so re-seeding actually re-applies colors + floating assets.
    theme.set({
      colors,
      floating_assets: floatingAssets,
      is_demo: true,
      status: "active",
    });
    await theme.save();
  }
  console.log(`✓ theme ${theme.theme_slug} (${floatingAssets.length} floats)`);

  // 2) Categories (nested) — build a slug → _id map for product assignment.
  const catIdBySlug = new Map<string, any>();
  const catPathBySlug = new Map<string, any[]>();

  const insertCat = async (
    node: DemoCategory,
    parentId: any | null,
    parentPath: any[],
    depth: number,
  ) => {
    const logo = node.logo ? images.get(node.logo.slug) : null;
    const created = await CategoryModel.create({
      category_name: node.name,
      category_slug: node.slug,
      category_status: "active",
      category_serial: node.serial,
      ...(logo ? { category_logo: logo.Location, category_logo_key: logo.Key } : {}),
      parent_id: parentId,
      category_path: parentPath,
      depth,
      category_publisher_id: publisherId,
      is_demo: true,
    });
    const myPath = [...parentPath, created._id];
    catIdBySlug.set(node.slug, created._id);
    catPathBySlug.set(node.slug, parentPath); // product stores ancestors of its leaf
    if (node.children) {
      for (const child of node.children) {
        await insertCat(child, created._id, myPath, depth + 1);
      }
    }
  };
  for (const root of DEMO_CATEGORIES) {
    await insertCat(root, null, [], 0);
  }
  console.log(`✓ ${catIdBySlug.size} categories`);

  // 3) Attributes (+ values). Build slug → { attrId, valueIdBySlug } for
  //    variation combinations.
  const attrBySlug = new Map<
    string,
    { attrId: any; display_type: string; tracks_weight: boolean; valueIdBySlug: Map<string, any>; valueMeta: Map<string, any> }
  >();
  for (const a of DEMO_ATTRIBUTES) {
    const created = await AttributeModel.create({
      attribute_name: a.name,
      attribute_slug: a.slug,
      attribute_status: "active",
      display_type: a.display_type,
      tracks_weight: a.tracks_weight,
      attribute_values: a.values.map((v) => ({
        attribute_value_name: v.name,
        attribute_value_slug: v.slug,
        attribute_value_code: v.code,
        attribute_value_status: "active",
        weight_grams_value: v.weight_grams ?? null,
      })),
      attribute_publisher_id: publisherId,
      is_demo: true,
    });
    const valueIdBySlug = new Map<string, any>();
    const valueMeta = new Map<string, any>();
    created.attribute_values.forEach((v: any, i: number) => {
      valueIdBySlug.set(a.values[i].slug, v._id);
      valueMeta.set(a.values[i].slug, a.values[i]);
    });
    attrBySlug.set(a.slug, {
      attrId: created._id,
      display_type: a.display_type,
      tracks_weight: a.tracks_weight,
      valueIdBySlug,
      valueMeta,
    });
  }
  console.log(`✓ ${attrBySlug.size} attributes`);

  // 4) Banners + Sliders
  await BannerModel.insertMany(
    DEMO_BANNERS.map((b) => ({
      banner_title: b.title,
      banner_image: images.get(b.image.slug)!.Location,
      banner_image_key: images.get(b.image.slug)!.Key,
      banner_serial: b.serial,
      banner_status: "active",
      is_demo: true,
    })),
  );
  await SliderModel.insertMany(
    DEMO_SLIDERS.map((s) => ({
      slider_image: images.get(s.image.slug)!.Location,
      slider_image_key: images.get(s.image.slug)!.Key,
      slider_serial: s.serial,
      slider_status: "active",
      is_demo: true,
    })),
  );
  console.log(`✓ ${DEMO_BANNERS.length} banners, ${DEMO_SLIDERS.length} sliders`);

  // 5) Products (+ variations + reviews)
  let productCount = 0;
  let variationCount = 0;
  let reviewCount = 0;

  for (const p of DEMO_PRODUCTS) {
    const isVariation = !!p.variation;
    const mainImg = images.get(p.main_image.slug)!;
    const otherImgs = (p.other_images || []).map((i) => {
      const r = images.get(i.slug)!;
      return { other_image: r.Location, other_image_key: r.Key };
    });

    // Variation wiring — link the product to its axis attribute so the PDP
    // picker + filter render. Built from the REAL seeded attribute + value ids.
    let productAttributes: any[] = [];
    let variantAxes: any[] = [];
    let attributesDetails: any[] = [];
    if (isVariation) {
      const attr = attrBySlug.get(p.variation!.attribute_slug);
      if (!attr) throw new Error(`Demo product "${p.slug}" references unknown attribute "${p.variation!.attribute_slug}"`);
      const chosenValueIds = p.variation!.rows.map((r) => {
        const id = attr.valueIdBySlug.get(r.value_slug);
        if (!id) throw new Error(`Demo product "${p.slug}" references unknown value "${r.value_slug}"`);
        return id;
      });
      productAttributes = [
        { attribute_id: attr.attrId, value_ids: chosenValueIds, show_in_filter: true },
      ];
      variantAxes = [{ attribute_id: attr.attrId, is_mandatory: true }];
      attributesDetails = [
        {
          attribute_id: attr.attrId,
          attribute_name: DEMO_ATTRIBUTES.find((a) => a.slug === p.variation!.attribute_slug)!.name,
          attribute_values: p.variation!.rows.map((r) => {
            const meta = attr.valueMeta.get(r.value_slug);
            return { attribute_value_name: meta.name, attribute_value_code: meta.code };
          }),
        },
      ];
    }

    const created = await ProductModel.create({
      product_name: p.name,
      product_slug: p.slug,
      product_status: "active",
      category_id: catIdBySlug.get(p.category_slug),
      category_path: catPathBySlug.get(p.category_slug) || [],
      description: p.description,
      short_description: p.short_description,
      badge_text: p.badge_text,
      hero_corner_badge: p.hero_corner_badge,
      main_image: mainImg.Location,
      main_image_key: mainImg.Key,
      other_images: otherImgs,
      product_price: p.price,
      product_discount_price: p.discount_price,
      product_quantity: p.quantity,
      unit: p.unit,
      is_variation: isVariation,
      product_type: isVariation ? "variable" : "simple",
      product_attributes: productAttributes,
      variant_axes: variantAxes,
      attributes_details: attributesDetails,
      theme_id: theme._id,
      short_features: (p.short_features || []).map((t) => ({ text: t })),
      benefits: p.benefits || [],
      use_cases: (p.use_cases || []).map((u) => ({ text: u.text })),
      nutrition: p.nutrition,
      faqs: p.faqs || [],
      // OG meta — og_image falls back to the product main image.
      og_title: p.og_title,
      og_description: p.og_description,
      og_image: mainImg.Location,
      og_image_key: mainImg.Key,
      trending_product: true,
      product_publisher_id: publisherId,
      is_demo: true,
    });
    productCount += 1;

    // Variations
    if (isVariation) {
      const attr = attrBySlug.get(p.variation!.attribute_slug)!;
      const rows = p.variation!.rows.map((r) => {
        const valueId = attr.valueIdBySlug.get(r.value_slug);
        const meta = attr.valueMeta.get(r.value_slug);
        return {
          variation_name: `${p.name} - ${meta.name}`,
          product_id: created._id,
          variation_price: r.price,
          variation_discount_price: r.discount_price,
          variation_quantity: r.quantity,
          variation_weight_grams: attr.tracks_weight ? meta.weight_grams ?? null : null,
          combination: [valueId], // single-axis → one id (already "sorted")
          is_active: true,
        };
      });
      const inserted = await VariationModel.insertMany(rows, { ordered: true });
      variationCount += inserted.length;
    }

    // Reviews (is_seeded — not is_demo)
    if (p.reviews?.length) {
      await ReviewModel.insertMany(
        p.reviews.map((rv) => ({
          review_description: rv.text,
          review_ratting: rv.rating,
          review_status: "active",
          review_product_id: created._id,
          is_seeded: true,
          source: "demo_seed",
          reviewer_name: rv.name,
          reviewer_verified: rv.verified,
        })),
      );
      reviewCount += p.reviews.length;
    }
  }
  console.log(`✓ ${productCount} products, ${variationCount} variations, ${reviewCount} reviews`);
};

// ──────────────────────────────────────────────────────────────────────────
// run
// ──────────────────────────────────────────────────────────────────────────
const run = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI not set in .env");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("Connected to MongoDB.\n");

  try {
    // Need a super-admin for the *_publisher_id refs.
    const admin = await AdminModel.findOne({ admin_status: "active" })
      .sort({ createdAt: 1 })
      .lean();
    if (!admin) {
      throw new Error(
        "No active admin found — run `npm run bootstrap` first so demo docs have a publisher.",
      );
    }
    const publisherId = admin._id;

    // Re-run guard.
    const existing = await ProductModel.countDocuments({ is_demo: true });
    if (existing > 0) {
      if (!force) {
        console.log(
          `• ${existing} demo product(s) already present — nothing to do. Re-run with --force to clear + re-seed.`,
        );
        return;
      }
      console.log(`• --force: clearing existing demo data first…`);
      const cleared = await clearDemoDataServices();
      console.log("  cleared:", cleared);
    }

    await assertNoSlugCollisions();

    console.log("Resolving demo images to S3…");
    const images = await resolveAllImages();

    console.log("\nSeeding demo catalog…");
    try {
      await seed(publisherId, images);
    } catch (seedErr: any) {
      console.error("\n❌ Seed failed mid-way — rolling back demo data…", seedErr?.message || seedErr);
      try {
        const rolled = await clearDemoDataServices();
        console.log("  rollback removed:", rolled);
      } catch (rbErr) {
        console.error("  ⚠️ rollback ALSO failed — manual cleanup needed:", rbErr);
      }
      throw seedErr;
    }

    const counts = await countDemoDataServices();
    console.log("\n✅ Demo seed complete:", counts);
    console.log("   Remove anytime from Admin → Settings → Demo Data → Clear, or `npm run seed:demo -- --force` to re-seed.");
  } catch (err: any) {
    console.error("\n❌ seed:demo failed:", err?.message || err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected.");
  }
};

run();
