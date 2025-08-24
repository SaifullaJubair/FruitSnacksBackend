import { Schema, model } from "mongoose";
import { ICategoryInterface } from "./category.interface";

// Category Schema
const categorySchema = new Schema<ICategoryInterface>(
  {
    category_name: {
      required: true,
      type: String,
    },
    category_slug: {
      required: true,
      type: String,
      unique: true,
    },
    category_logo: {
      type: String,
    },
    category_logo_key: {
      type: String,
    },
    category_video: {
      type: String,
    },
    category_video_key: {
      type: String,
    },
    category_status: {
      required: true,
      type: String,
      enum: ["active", "in-active"],
      default: "active",
    },
    category_serial: {
      required: true,
      type: Number,
    },
    explore_category_show: {
      type: Boolean,
      enum: [true, false],
    },
    feature_category_show: {
      type: Boolean,
      enum: [true, false],
    },
    category_publisher_id: {
      type: Schema.Types.ObjectId,
      ref: "admins",
      required: true,
    },
    category_updated_by: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
  },
  {
    timestamps: true,
  }
);

const CategoryModel = model<ICategoryInterface>("categories", categorySchema);

export default CategoryModel;
