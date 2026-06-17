import { Schema, model } from "mongoose";
import { IFlashSaleInterface } from "./flashsale.interface";

const flashSaleSchema = new Schema<IFlashSaleInterface>(
  {
    title: { type: String, required: true },
    description: { type: String },
    start_at: { type: Date, required: true },
    end_at: { type: Date, required: true },
    status: {
      type: String,
      enum: ["active", "in-active"],
      // Default in-active so a flash sale never goes live just because the admin
      // saved it without an explicit status (matches coupon/campaign/offer).
      default: "in-active",
    },
    products: [
      {
        _id: false,
        product_id: {
          type: Schema.Types.ObjectId,
          ref: "products",
          required: true,
        },
        flash_price: { type: Number, required: true },
        flash_price_type: {
          type: String,
          enum: ["fixed", "percent"],
          default: "fixed",
        },
        active: { type: Boolean, default: true },
      },
    ],
    flash_sale_publisher_id: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
    flash_sale_updated_by: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
  },
  { timestamps: true },
);

const FlashSaleModel = model<IFlashSaleInterface>("flashsales", flashSaleSchema);
export default FlashSaleModel;
