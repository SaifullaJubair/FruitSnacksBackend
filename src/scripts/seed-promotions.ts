/**
 * seed-promotions.ts — fill the empty marketing/inventory collections with
 * believable, TESTABLE rows so the storefront price-flow (flash / campaign /
 * offer) and admin dropdowns (warehouse / supplier) can be exercised end-to-end.
 *
 *   npm run seed:promo            # seed (skips anything already seeded)
 *   npm run seed:promo -- --force # delete previously seeded rows, then re-seed
 *
 * Design notes:
 *   • Idempotent — these promo schemas have NO `is_demo` field (mongoose strict
 *     mode would silently drop it), so we mark + detect our rows by the
 *     "(Demo)" suffix in their title/name. The re-run guard skips when our rows
 *     already exist; --force clears only rows matching that marker (never touches
 *     client-real data).
 *   • Needs an active super-admin (publisher refs). Aborts if none — run
 *     `npm run bootstrap` first.
 *   • Picks SIMPLE products (with a real product_price) for flash/campaign so the
 *     percent/fixed math is unambiguous (variation products keep price on rows).
 *   • Campaign seeding mirrors campaign.services: also sets product_campaign_id
 *     on each product, so PDP + cart enrich can find it. A product can be in
 *     only ONE campaign at a time → we pick products with no campaign yet.
 *   • Dates: flash uses Date objects (start_at/end_at). campaign/offer use
 *     YYYY-MM-DD strings (their schema stores String). Window = now-1h … now+30d.
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";

import AdminModel from "../app/adminRegLog/admin.model";
import ProductModel from "../app/product/product.model";
import FlashSaleModel from "../app/flashsale/flashsale.model";
import CampaignModel from "../app/campaign/campaign.model";
import OfferModel from "../app/offer/offer.model";
import WarehouseModel from "../app/warehouse/warehouse.model";
import SupplierModel from "../app/supplier/supplier.model";

const force = process.argv.includes("--force");

// These schemas have no is_demo field → detect our seeded rows by this marker
// in their title/name. Keep it in sync with the titles created below.
const DEMO_MARK = /\(Demo\)/;

// A throwaway transparent 1x1 PNG hosted by a stable CDN — campaigns/offers
// require an image URL. Using a placeholder avoids an S3 upload for a dev seed.
const PLACEHOLDER_IMG =
  "https://placehold.co/800x400/22c55e/ffffff/png?text=Demo+Promo";

const ymd = (d: Date) => d.toISOString().slice(0, 10);

const run = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI not set in .env");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("Connected to MongoDB.\n");

  try {
    const admin = await AdminModel.findOne({ admin_status: "active" })
      .sort({ createdAt: 1 })
      .lean();
    if (!admin) {
      throw new Error(
        "No active admin found — run `npm run bootstrap` first so seeded docs have a publisher.",
      );
    }
    const publisherId = admin._id;
    console.log(`Publisher (admin): ${publisherId}\n`);

    // ── --force: clear only OUR seeded rows ────────────────────────────────
    if (force) {
      console.log("• --force: clearing previously seeded promo rows…");
      // un-stamp products that our campaign attached
      const campSeeded = await CampaignModel.find({ campaign_title: DEMO_MARK }).lean();
      const attachedProductIds = campSeeded.flatMap((c: any) =>
        (c.campaign_products || []).map((p: any) => p.campaign_product_id),
      );
      if (attachedProductIds.length) {
        await ProductModel.updateMany(
          { _id: { $in: attachedProductIds } },
          { $unset: { product_campaign_id: "" } },
        );
      }
      const r1 = await FlashSaleModel.deleteMany({ title: DEMO_MARK });
      const r2 = await CampaignModel.deleteMany({ campaign_title: DEMO_MARK });
      const r3 = await OfferModel.deleteMany({ offer_title: DEMO_MARK });
      const r4 = await WarehouseModel.deleteMany({ name: DEMO_MARK });
      const r5 = await SupplierModel.deleteMany({ supplier_name: DEMO_MARK });
      console.log(
        `  cleared: flash=${r1.deletedCount} campaign=${r2.deletedCount} offer=${r3.deletedCount} warehouse=${r4.deletedCount} supplier=${r5.deletedCount}\n`,
      );
    }

    const now = new Date();
    const startDate = new Date(now.getTime() - 60 * 60 * 1000); // now - 1h
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // now + 30d

    // ── Warehouse + Supplier (cheap, no product deps) ──────────────────────
    if (!(await WarehouseModel.exists({ name: DEMO_MARK }))) {
      await WarehouseModel.create([
        {
          name: "Main Warehouse (Demo)",
          code: "WH-DHK-01",
          address: "Mirpur DOHS, Dhaka",
          city: "Dhaka",
          is_default: true,
          status: "active",
          publisher_id: publisherId,
        },
        {
          name: "Chattogram Hub (Demo)",
          code: "WH-CTG-02",
          address: "Agrabad, Chattogram",
          city: "Chattogram",
          is_default: false,
          status: "active",
          publisher_id: publisherId,
        },
      ]);
      console.log("✓ 2 warehouses");
    } else {
      console.log("• warehouses already seeded — skip");
    }

    if (!(await SupplierModel.exists({ supplier_name: DEMO_MARK }))) {
      await SupplierModel.create([
        {
          supplier_name: "Fresh Farms Ltd (Demo)",
          supplier_phone: "01710000001",
          supplier_address: "Savar, Dhaka",
          supplier_status: "active",
          supplier_publisher_id: publisherId,
        },
        {
          supplier_name: "Dried Goods Co (Demo)",
          supplier_phone: "01710000002",
          supplier_address: "Tongi, Gazipur",
          supplier_status: "active",
          supplier_publisher_id: publisherId,
        },
      ]);
      console.log("✓ 2 suppliers");
    } else {
      console.log("• suppliers already seeded — skip");
    }

    // ── Pick SIMPLE products with a real price ─────────────────────────────
    const simpleProducts = await ProductModel.find({
      product_status: "active",
      is_variation: { $ne: true },
      product_price: { $gt: 0 },
    })
      .select("_id product_name product_slug product_price product_campaign_id")
      .limit(20)
      .lean();

    // flash / campaign / offer each get their OWN distinct products so every
    // promotion can be price-tested in isolation (no flash+campaign overlap on
    // one product, which would make "which price wins" ambiguous).
    if (simpleProducts.length < 6) {
      throw new Error(
        `Need at least 6 simple priced products to seed isolated promos; found ${simpleProducts.length}.`,
      );
    }

    // ── Flash Sale (2 products: 1 percent, 1 fixed) ────────────────────────
    if (!(await FlashSaleModel.exists({ title: DEMO_MARK }))) {
      const fp1 = simpleProducts[0];
      const fp2 = simpleProducts[1];
      await FlashSaleModel.create({
        title: "Weekend Flash Sale (Demo)",
        description: "Limited-time demo flash sale for testing price flow.",
        start_at: startDate,
        end_at: endDate,
        status: "active",
        products: [
          { product_id: fp1._id, flash_price: 20, flash_price_type: "percent", active: true },
          { product_id: fp2._id, flash_price: 100, flash_price_type: "fixed", active: true },
        ],
        flash_sale_publisher_id: publisherId,
      });
      console.log(
        `✓ flash sale — percent20%: ${fp1.product_slug} (৳${fp1.product_price}), fixed৳100: ${fp2.product_slug} (৳${fp2.product_price})`,
      );
    } else {
      console.log("• flash sale already seeded — skip");
    }

    // ── Campaign (products [2],[3] — distinct from flash) ──────────────────
    if (!(await CampaignModel.exists({ campaign_title: DEMO_MARK }))) {
      const cp1 = simpleProducts[2];
      const cp2 = simpleProducts[3];
      if (cp1.product_campaign_id || cp2.product_campaign_id) {
        throw new Error(
          "Campaign target product already in another campaign — run with --force or pick others.",
        );
      }
      const campaign = await CampaignModel.create({
        campaign_image: PLACEHOLDER_IMG,
        campaign_title: "Eid Mega Campaign (Demo)",
        campaign_description: "Demo campaign for cart/PDP price-flow testing.",
        campaign_start_date: ymd(startDate),
        campaign_end_date: ymd(endDate),
        campaign_status: "active",
        campaign_publisher_id: publisherId,
        campaign_products: [
          { campaign_product_id: cp1._id, campaign_product_price: 15, campaign_price_type: "percent", campaign_product_status: "active" },
          { campaign_product_id: cp2._id, campaign_product_price: 150, campaign_price_type: "fixed", campaign_product_status: "active" },
        ],
      });
      // Mirror campaign.services: stamp product_campaign_id so PDP + cart enrich
      // can resolve it.
      await ProductModel.updateMany(
        { _id: { $in: [cp1._id, cp2._id] } },
        { $set: { product_campaign_id: campaign._id } },
      );
      console.log(
        `✓ campaign — percent15%: ${cp1.product_slug} (৳${cp1.product_price}), fixed৳150: ${cp2.product_slug} (৳${cp2.product_price}) [product_campaign_id set]`,
      );
    } else {
      console.log("• campaign already seeded — skip");
    }

    // ── Offer (products [4],[5] — distinct from flash + campaign) ──────────
    if (!(await OfferModel.exists({ offer_title: DEMO_MARK }))) {
      const op1 = simpleProducts[4];
      const op2 = simpleProducts[5];
      await OfferModel.create({
        offer_image: PLACEHOLDER_IMG,
        offer_title: "Buy More Save More (Demo)",
        offer_description: "Demo bundle offer for PDP offer-banner testing.",
        offer_start_date: ymd(startDate),
        offer_end_date: ymd(endDate),
        offer_status: "active",
        offer_publisher_id: publisherId,
        offer_products: [
          { offer_product_id: op1._id, offer_product_quantity: 2, offer_discount_price: 10, offer_discount_type: "percent" },
          { offer_product_id: op2._id, offer_product_quantity: 1, offer_discount_price: 50, offer_discount_type: "fixed" },
        ],
      });
      console.log(
        `✓ offer — ${op1.product_slug} + ${op2.product_slug}`,
      );
    } else {
      console.log("• offer already seeded — skip");
    }

    console.log("\n✅ Promo seed complete.");
    console.log("   Re-run with `npm run seed:promo -- --force` to reset.");
  } catch (err: any) {
    console.error("\n❌ seed:promo failed:", err?.message || err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected.");
  }
};

run();
