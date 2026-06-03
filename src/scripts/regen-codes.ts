/**
 * One-shot migration to bring all existing products + variations onto the
 * 2026-05-30 SKU/Barcode/QR redesign:
 *   - SKU format `FS-HASH-AXIS` (name-independent)
 *   - 5-char `qr_short_code` + permanent `/q/<code>` QR URL
 *   - Old QR S3 images cleaned up (best-effort)
 *
 * Idempotent: re-running the script on a partially-migrated DB is safe.
 * Each product is skipped if it already has a 2026-05-30-shape SKU AND a
 * `qr_short_code`.
 *
 * Usage:
 *   cd FruitSnacksBackend
 *   NODE_ENV=development npx ts-node-dev --transpile-only src/scripts/regen-codes.ts
 *
 * The script connects to MONGO_URI from .env and exits when done.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import ProductModel from "../app/product/product.model";
import VariationModel from "../app/variation/variation.model";
import SettingModel from "../app/setting/setting.model";
import { FileUploadHelper } from "../helpers/image.upload";
import { renderBarcodeImage, renderQrImage } from "../helpers/code.images";
import {
  buildQrPayload,
  buildSku,
  buildVariationAxisCodes,
  generateUniqueBarcode,
  generateUniqueShortCode,
  resolveVariationAxisValues,
  generateHash,
} from "../app/product/product.codes";

const log = (...args: any[]) => console.log("[regen-codes]", ...args);

const isLegacySkuShape = (sku?: string): boolean => {
  if (!sku) return true;
  // New shape: PREFIX-HASH(6)-AXIS?-AXIS?-AXIS?  → 2-5 parts, part[1] is 6 chars
  // Old shape: PREFIX-NOUN-AXIS?-AXIS?-AXIS?-HASH(6) → noun present, hash trailing
  const parts = sku.split("-");
  if (parts.length < 2) return true;
  return parts[1].length !== 6 || !/^[A-Za-z0-9]{6}$/.test(parts[1]);
};

async function migrateProducts() {
  const settings: any = await SettingModel.findOne()
    .select("sku_prefix barcode_default_format")
    .lean();
  const skuPrefix = settings?.sku_prefix || "FS";
  const bcFormat = settings?.barcode_default_format || "CODE128";

  const products: any[] = await ProductModel.find().lean();
  log(`Found ${products.length} products to evaluate`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const product of products) {
    try {
      const needsNewSku = isLegacySkuShape(product.product_sku);
      const needsShortCode = !product.qr_short_code;
      // Even if parent is fine, variations may still be on legacy shape
      // (separate codepath). Probe one variation to decide.
      let variationsNeedMigration = false;
      if (product.is_variation) {
        const sampleVar: any = await VariationModel.findOne({
          product_id: product._id,
        })
          .select("variation_sku")
          .lean();
        if (sampleVar && isLegacySkuShape(sampleVar.variation_sku)) {
          variationsNeedMigration = true;
        }
      }

      if (!needsNewSku && !needsShortCode && !variationsNeedMigration) {
        skipped++;
        continue;
      }

      const update: any = {};

      // 1. New SKU (with fresh hash) if legacy shape. If parent is fine but
      // variations need migrating, we still need a hash to share — fall back
      // to existing product_sku_hash, or generate a fresh one if absent.
      let newHash = product.product_sku_hash;
      if (needsNewSku) {
        newHash = generateHash();
        update.product_sku = buildSku({ prefix: skuPrefix, hash: newHash });
        update.product_sku_hash = newHash;
      } else if (!newHash && variationsNeedMigration) {
        // Edge case: new-shape parent missing the hash field (data drift).
        // Parse hash out of the SKU itself.
        const parts = (product.product_sku || "").split("-");
        newHash = parts[1] || generateHash();
        update.product_sku_hash = newHash;
      }

      // 2. New short code
      if (needsShortCode) {
        update.qr_short_code = await generateUniqueShortCode();
      }

      // 3. New QR image
      const shortCode = update.qr_short_code || product.qr_short_code;
      if (shortCode && product.product_slug) {
        // Delete old QR image if present
        if (product.qr_code_image_key) {
          try {
            await FileUploadHelper.deleteFromSpaces(product.qr_code_image_key);
          } catch {}
        }
        const payload = await buildQrPayload(shortCode);
        const qr = await renderQrImage(payload, product.product_slug);
        update.qr_code = payload;
        update.qr_code_image = qr.Location;
        update.qr_code_image_key = qr.Key;
        update.qr_code_updated_at = new Date();
      }

      // 4. Backfill barcode if missing on non-variation product
      if (!product.barcode && !product.is_variation) {
        update.barcode = await generateUniqueBarcode("product");
        try {
          const img = await renderBarcodeImage(update.barcode, bcFormat);
          update.barcode_image = img.Location;
          update.barcode_image_key = img.Key;
          update.barcode_format = bcFormat;
        } catch (e) {
          log(`  barcode render failed for ${product._id}`, e);
        }
      }

      await ProductModel.updateOne({ _id: product._id }, { $set: update });

      // 5. Migrate variations (per-product, share newHash)
      if (product.is_variation && newHash) {
        const variations: any[] = await VariationModel.find({
          product_id: product._id,
        }).lean();
        for (const v of variations) {
          const vUpdate: any = {};
          if (isLegacySkuShape(v.variation_sku)) {
            const axisValues = await resolveVariationAxisValues(
              product.variant_axes || [],
              v.combination || [],
            );
            const axisCodes = await buildVariationAxisCodes({
              product_id: String(product._id),
              variation_axis_values: axisValues,
              product_variant_axes: product.variant_axes || [],
              excludeVariationId: String(v._id),
            });
            vUpdate.variation_sku = buildSku({
              prefix: skuPrefix,
              hash: newHash,
              axisCodes,
            });
          }
          if (!v.variation_barcode) {
            vUpdate.variation_barcode = await generateUniqueBarcode("variation");
            try {
              const img = await renderBarcodeImage(
                vUpdate.variation_barcode,
                bcFormat,
              );
              vUpdate.variation_barcode_image = img.Location;
              vUpdate.variation_barcode_image_key = img.Key;
              vUpdate.variation_barcode_format = bcFormat;
            } catch (e) {
              log(`  variation barcode render failed for ${v._id}`, e);
            }
          }
          if (Object.keys(vUpdate).length > 0) {
            await VariationModel.updateOne({ _id: v._id }, { $set: vUpdate });
          }
        }
      }

      migrated++;
      log(`  ✓ migrated ${product._id} (${product.product_name})`);
    } catch (e) {
      errors++;
      log(`  ✗ FAILED for ${product._id}`, e);
    }
  }

  log(`Done. migrated=${migrated}  skipped=${skipped}  errors=${errors}`);
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI not set in .env");
  }
  log("Connecting to Mongo...");
  await mongoose.connect(process.env.MONGO_URI);
  log("Connected.");
  try {
    await migrateProducts();
  } finally {
    await mongoose.disconnect();
    log("Disconnected.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
