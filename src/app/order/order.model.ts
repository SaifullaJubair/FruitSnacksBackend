import { Schema, model } from "mongoose";
import { IOrderInterface } from "./order.interface";

// order Schema
const orderSchema = new Schema<IOrderInterface>(
  {
    invoice_id: {
      required: true,
      type: String,
    },
    order_status: {
      required: true,
      type: String,
      enum: [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancel",
        "return",
      ],
      default: "pending",
    },
    pending_time: {
      type: String,
    },
    processing_time: {
      type: String,
    },
    shipped_time: {
      type: String,
    },
    delivered_time: {
      type: String,
    },
    cancel_time: {
      type: String,
    },
    return_time: {
      type: String,
    },
    sub_total_amount: {
      required: true,
      type: Number,
    },
    shipping_cost: {
      required: true,
      type: Number,
    },
    discount_amount: {
      required: true,
      type: Number,
      default: 0,
    },
    grand_total_amount: {
      required: true,
      type: Number,
    },
    coupon_id: {
      type: Schema.Types.ObjectId,
      ref: "coupons",
    },
    shipping_location: {
      required: true,
      type: String,
    },
    billing_country: {
      required: true,
      type: String,
    },
    billing_city: {
      required: true,
      type: String,
    },
    billing_state: {
      required: true,
      type: String,
    },
    billing_address: {
      required: true,
      type: String,
    },
    customer_id: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    customer_phone: {
      required: true,
      type: String,
    },
    order_updated_by: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
    tracking_code: {
      type: String,
    },
    pathao_city_id: {
      required: true,
      type: Number,
    },
    pathao_city_name: {
      required: true,
      type: String,
    },
    pathao_zone_id: {
      required: true,
      type: Number,
    },
    pathao_zone_name: {
      required: true,
      type: String,
    },
    // Pathao status
    pathao_status: {
      type: String,
    },
    consignment_id: {
      type: String,
    },
    delivery_fee: {
      type: Number,
    },
    // new thing

    courier_type: {
      type: String,
      enum: ["pathao", "steadfast"],
    },
    steadfast_consignment_id: {
      type: String,
    },
    steadfast_tracking_code: {
      type: String,
    },
    steadfast_status: {
      type: String,
      enum: [
        "in_review",
        "pending",
        "delivered_approval_pending",
        "partial_delivered_approval_pending",
        "cancelled_approval_pending",
        "unknown_approval_pending",
        "delivered",
        "partial_delivered",
        "cancelled",
        "hold",
        "unknown",
      ],
      default: "in_review",
    },
    steadfast_tracking_message: {
      type: String,
    },
    // ── Delivery override fields ───────────────────────────────────────────────
    delivery_name: {
      type: String,
    },
    delivery_phone: {
      type: String,
    },
    delivery_alt_phone: {
      type: String,
    },
    delivery_address: {
      type: String,
    },
    delivery_note: {
      type: String,
    },
    // ── Stock lifecycle (Phase B) ──────────────────────────────────────────────
    // Stock is decremented at placement; restored exactly once on cancel/return.
    stock_restored: {
      type: Boolean,
      default: false,
    },
    // ── Payment (Phase C) ──────────────────────────────────────────────────────
    payment_method: {
      type: String,
      enum: ["cod", "manual_mfs", "sslcommerz", "bank_transfer"],
      default: "cod",
    },
    payment_status: {
      type: String,
      enum: ["unpaid", "pending", "paid", "partial", "failed", "refunded"],
      default: "unpaid",
    },
    transaction_id: { type: String },
    paid_amount: { type: Number, default: 0 },
    advance_amount: { type: Number, default: 0 },
    paid_at: { type: String },
    payment_meta: { type: Schema.Types.Mixed },

    // Phase H — VAT/tax recomputed server-side at placement.
    vat_amount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  },
);

const OrderModel = model<IOrderInterface>("orders", orderSchema);

export default OrderModel;
