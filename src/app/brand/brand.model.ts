import { Schema, model } from "mongoose";
import { IBrandInterface } from "./brand.interface";

// Brand Schema
const brandSchema = new Schema<IBrandInterface>(
  {
    brand_name: {
      required: true,
      type: String,
    },
    brand_slug: {
      required: true,
      type: String,
    },
    brand_logo: {
      required: true,
      type: String,
    },
    brand_logo_key: {
      required: true,
      type: String,
    },
    brand_status: {
      required: true,
      type: String,
      enum: ["active", "in-active"],
      default: "active",
    },
    brand_serial: {
      required: true,
      type: Number,
    },
    brand_show: {
      enum: [true, false],
      type: Boolean,
    },
    category_id: {
      // required: true,
      type: Schema.Types.ObjectId,
      ref: "categories",
    },
    brand_publisher_id: {
      required: true,
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
    brand_updated_by: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
  },
  {
    timestamps: true,
  }
);

const BrandModel = model<IBrandInterface>("brands", brandSchema);

export default BrandModel;
