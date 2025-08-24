import mongoose, { Schema, model } from "mongoose";
import { ICouponUsedInterface } from "./coupon.used.interface";

// Coupon used Schema
const couponUsedSchema = new Schema<ICouponUsedInterface>(
  {
    used: {
      required: true,
      type: Number,
    },
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    coupon_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "coupons",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const CouponUsedModel = model<ICouponUsedInterface>(
  "couponcustomers",
  couponUsedSchema
);

export default CouponUsedModel;
