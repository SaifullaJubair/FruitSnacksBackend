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
    // S4+S5 Phase 1C — optional. Post-order prompt writes here for
    // guest orders; on later user registration with matching phone,
    // auth controller backfills user.user_email.
    customer_email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    order_updated_by: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
    tracking_code: {
      type: String,
    },
    // D18 BLOCKER 3 — POS walk-in/pickup has no Pathao zone; all optional
    pathao_city_id: { type: Number },
    pathao_city_name: { type: String },
    pathao_zone_id: { type: Number },
    pathao_zone_name: { type: String },
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

    // Phase G3 (F1b) cart-side loyalty redeem.
    loyalty_redeem_points: { type: Number, default: 0 },
    loyalty_redeem_amount: { type: Number, default: 0 },

    // S4+S5 Phase 1B — server-side Purchase event dedup. CAPI services
    // skip re-fire when these flags are true (set after first success).
    meta_purchase_sent: { type: Boolean, default: false },
    tiktok_purchase_sent: { type: Boolean, default: false },

    // D18 POS fields
    order_source: {
      type: String,
      enum: ["storefront", "admin"],
      default: "storefront",
    },
    admin_manual_discount: { type: Number, default: 0 },
    admin_created_by: { type: Schema.Types.ObjectId, ref: "admins" },
    manual_discount_reason: { type: String },
    // D18-B — POS payment method label (cash/bkash/nagad/card/bank). Separate
    // from payment_method enum which stays "cod" for POS orders (no gateway).
    payment_method_note: { type: String },
  },
  {
    timestamps: true,
  },
);

// E20 BLOCKER 2 — dashboard period + status aggregations need this to avoid
// full collection scans. Also added to deploy-day checklist: run
// db.orders.createIndex({ createdAt: -1, order_status: 1 }) on PROD.
orderSchema.index({ createdAt: -1, order_status: 1 });

const OrderModel = model<IOrderInterface>("orders", orderSchema);

export default OrderModel;
