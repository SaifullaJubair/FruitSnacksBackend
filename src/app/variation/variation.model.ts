import { Schema, model } from "mongoose";
import { IVariationInterface } from "./variation.interface";

// Variation Schema
const variationSchema = new Schema<IVariationInterface>(
  {
    variation_name: {
      type: String,
      required: true
    },
    product_id: {
      type: Schema.Types.ObjectId,
      ref: "products", // Ensure this references the correct model
      required: true,
    },
    variation_price: {
      type: Number,
      required: true,
    },
    variation_discount_price: {
      type: Number,
    },
    variation_buying_price: {
      type: Number,
    },
    variation_quantity: {
      type: Number,
      required: true,
    },
    variation_alert_quantity: {
      type: Number,
    },
    variation_barcode: {
      // No inline `index: true` — sparse-unique index declared explicitly
      // below to avoid Mongoose's duplicate-index warning at boot.
      type: String,
    },
    variation_barcode_image: {
      type: String,
    },
    variation_barcode_image_key: {
      type: String,
    },
    variation_barcode_format: {
      type: String,
      enum: ["CODE128", "EAN13", "UPC", "ITF14", "CUSTOM"],
      default: "CODE128",
    },
    // Legacy single image (kept for back-compat — cart/order still read it as
    // the "primary" image when no array is present).
    variation_image: {
      type: String,
    },
    variation_image_key: {
      type: String,
    },
    // Multi-image gallery — first element is the primary (used wherever the
    // single legacy field used to render). Each element is an independent S3
    // URL copied (NOT referenced) from the product media pool, so deleting a
    // product main_image / other_image does not break the variation.
    variation_images: [
      {
        type: String,
      },
    ],
    variation_images_keys: [
      {
        type: String,
      },
    ],
    variation_video: {
      type: String,
    },
    variation_video_key: {
      type: String,
    },
    variation_sku: {
      // No inline `index: true` — sparse-unique index declared explicitly
      // below to avoid Mongoose's duplicate-index warning at boot.
      type: String,
    },
    variation_weight_grams: {
      type: Number,
      default: null,
    },
    variation_badge_text: {
      type: String,
      default: null,
    },
    // A4 (2026-06-04) — curated IconPicker key for the variation badge.
    // Rendered with theme primary as the bg color in PDP.
    variation_badge_icon_key: {
      type: String,
      default: null,
    },

    // ── Combination-stock engine (Phase 1, additive) ──
    // Sorted array of attribute_values._id (D2). Indexed so a chosen-combination
    // lookup ({ product_id, combination: [sorted ids] }) is fast.
    combination: [
      {
        type: Schema.Types.ObjectId,
        index: true,
      },
    ],
    // Price adjustment over the product base price (Phase 3 resolver adds this).
    variation_price_delta: {
      type: Number,
      default: 0,
    },
    // Per-combination on/off toggle (out-of-catalog without deleting the row).
    is_active: {
      type: Boolean,
      default: true,
    },

    // Phase H: optional per-variation warehouse override.
    warehouse_id: { type: Schema.Types.ObjectId, ref: "warehouses" },
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt fields
  }
);

// Sparse unique — uniqueness enforced when present; variations without SKU /
// barcode (legacy docs or simple-variation rows) don't collide.
variationSchema.index({ variation_sku: 1 }, { unique: true, sparse: true });
variationSchema.index({ variation_barcode: 1 }, { unique: true, sparse: true });

const VariationModel = model<IVariationInterface>("variations", variationSchema);

export default VariationModel;
