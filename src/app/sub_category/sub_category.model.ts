import { Schema, model } from "mongoose";
import { ISubCategoryInterface } from "./sub_category.interface";

// Sub Category Schema
const subcategorySchema = new Schema<ISubCategoryInterface>(
  {
    sub_category_name: {
      required: true,
      type: String,
    },
    sub_category_slug: {
      required: true,
      type: String,
    },
    sub_category_logo: {
      required: true,
      type: String,
    },
    sub_category_logo_key: {
      required: true,
      type: String,
    },
    sub_category_status: {
      required: true,
      type: String,
      enum: ["active", "in-active"],
      default: "active",
    },
    sub_category_serial: {
      required: true,
      type: Number,
    },
    category_id: {
      required: true,
      type: Schema.Types.ObjectId,
      ref: "categories",
    },
    sub_category_publisher_id: {
      required: true,
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
    sub_category_updated_by: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
  },
  {
    timestamps: true,
  }
);

const SubCategoryModel = model<ISubCategoryInterface>(
  "subcategories",
  subcategorySchema
);

export default SubCategoryModel;
