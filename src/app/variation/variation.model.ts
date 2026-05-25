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
      type: String,
    },
    variation_barcode_image: {
      type: String,
    },
    variation_image: {
      type: String,
    },
    variation_image_key: {
      type: String,
    },
    variation_video: {
      type: String,
    },
    variation_video_key: {
      type: String,
    },
    variation_sku: {
      type: String
    },
    variation_weight_grams: {
      type: Number,
      default: null,
    },
    variation_badge_text: {
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
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt fields
  }
);

const VariationModel = model<IVariationInterface>("variations", variationSchema);

export default VariationModel;
