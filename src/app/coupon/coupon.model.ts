import { Schema, model } from "mongoose";
import { ICouponInterface } from "./coupon.interface";

// Coupon Schema
const couponSchema = new Schema<ICouponInterface>(
  {
    coupon_code: {
      required: true,
      type: String,
    },
    coupon_start_date: {
      required: true,
      type: String,
    },
    coupon_end_date: {
      required: true,
      type: String,
    },
    coupon_type: {
      type: String,
      enum: ["fixed", "percent", "bogo"],
      required: true,
    },
    coupon_amount: {
      // 11β BLOCKER 2 — BOGO coupons don't use coupon_amount (discount lives in
      // bogo_get_discount_pct). Make required conditional so admins can save a
      // BOGO without typing a dummy amount.
      required: function (this: any) {
        return this?.coupon_type !== "bogo";
      },
      type: Number,
      default: 0,
    },
    coupon_use_per_person: {
      required: true,
      type: Number,
    },
    coupon_use_total_person: {
      required: true,
      type: Number,
    },
    coupon_available: {
      required: true,
      type: Number,
    },
    coupon_status: {
      type: String,
      enum: ["active", "in-active"],
      default: "in-active",
    },
    coupon_customer_type: {
      type: String,
      enum: ["all", "specific"],
      default: "all",
    },
    coupon_specific_customer: [
      {
        customer_id: {
          type: Schema.Types.ObjectId,
          ref: "users",
          required: true,
        },
      },
    ],
    coupon_max_amount: {
      type: Number,
    },
    coupon_product_type: {
      type: String,
      enum: ["all", "specific"],
      default: "all",
    },
    coupon_specific_product: [
      {
        product_id: {
          type: Schema.Types.ObjectId,
          ref: "products",
          required: true,
        },
      },
    ],
    coupon_publisher_id: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
    coupon_updated_by: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
    // Phase E — BOGO fields (used only when coupon_type === "bogo")
    // 11β N1 — min 1 on quantities; discount_pct stays free 0-100 (0 = nominal).
    bogo_buy_qty: { type: Number, min: 1 },
    bogo_get_qty: { type: Number, min: 1 },
    bogo_get_discount_pct: { type: Number, min: 0, max: 100 },
  },
  {
    timestamps: true,
  }
);

const CouponModel = model<ICouponInterface>("coupons", couponSchema);

export default CouponModel;
