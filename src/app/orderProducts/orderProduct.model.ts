import { Schema, model } from "mongoose";
import { IOrderProductInterface } from "./orderProduct.interface";

// orderProduct Schema
const orderProductSchema = new Schema<IOrderProductInterface>(
  {
    invoice_id: {
      required: true,
      type: String,
    },
    order_id: {
      type: Schema.Types.ObjectId,
      ref: "orders",
      required: true,
    },
    product_id: {
      type: Schema.Types.ObjectId,
      ref: "products",
      required: true,
    },
    variation_id: {
      type: Schema.Types.ObjectId,
      ref: "variations",
    },
    product_main_price: {
      type: Number,
      required: true,
    },
    product_main_discount_price: {
      type: Number,
      required: true,
      default: 0,
    },
    product_unit_price: {
      type: Number,
      required: true,
    },
    product_quantity: {
      type: Number,
      required: true,
    },
    product_unit_final_price: {
      type: Number,
      required: true,
    },
    product_grand_total_price: {
      type: Number,
      required: true,
    },
    campaign_id: {
      type: Schema.Types.ObjectId,
      ref: "campaigns",
    },
    customer_id: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    // Snapshot at placement (Phase 1 SKU/Barcode/QR). Write-once.
    product_sku_snapshot: { type: String },
    variation_sku_snapshot: { type: String },
    product_barcode_snapshot: { type: String },
    variation_barcode_snapshot: { type: String },

    // ── Order Unification Phase A (2026-06-11) ───────────────────────────────
    // Display snapshot (wired at placement). Consumers fall back to live
    // populate when null (legacy orders).
    product_name_snapshot: { type: String },
    product_image_snapshot: { type: String },
    // Which pricing layer set the final price (wired at placement).
    discount_source: {
      type: String,
      enum: ["offer", "campaign", "flash_sale", "coupon", "manual", "none"],
      default: "none",
    },
    // Per-line VAT (wired at placement from recompute vat_pct).
    vat_rate: { type: Number, default: 0 },
    vat_amount: { type: Number, default: 0 },
    // Per-line customization (slot only).
    customization_note: { type: String },
    customization_charge: { type: Number, default: 0 },
    customization_files: [{ type: String }],
    // Digital product (slot only).
    is_digital: { type: Boolean, default: false },
    download_url: { type: String },
    download_expires_at: { type: String },
    download_count: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

const OrderProductModel = model<IOrderProductInterface>(
  "orderproducts",
  orderProductSchema
);

export default OrderProductModel;
