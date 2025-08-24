import { Schema, model } from "mongoose";
import { IChildCategoryInterface } from "./child_category.interface";

// Child Category Schema
const childcategorySchema = new Schema<IChildCategoryInterface>(
  {
    child_category_name: {
      required: true,
      type: String,
    },
    child_category_slug: {
      required: true,
      type: String,
    },
    child_category_status: {
      required: true,
      type: String,
      enum: ["active", "in-active"],
      default: "active",
    },
    child_category_serial: {
      required: true,
      type: Number,
    },
    category_id: {
      required: true,
      type: Schema.Types.ObjectId,
      ref: "categories",
    },
    sub_category_id: {
      required: true,
      type: Schema.Types.ObjectId,
      ref: "subcategories",
    },
    child_category_publisher_id: {
      required: true,
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
    child_category_updated_by: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
  },
  {
    timestamps: true,
  }
);

const ChildCategoryModel = model<IChildCategoryInterface>(
  "childcategories",
  childcategorySchema
);

export default ChildCategoryModel;
