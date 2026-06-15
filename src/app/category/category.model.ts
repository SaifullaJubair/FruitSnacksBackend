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

    // ── Nested tree (self-referencing, infinite depth) ──
    parent_id: {
      type: Schema.Types.ObjectId,
      ref: "categories",
      default: null,
      index: true,
    },
    // Ordered ancestor ids (root → … → immediate parent). Lets us fetch a
    // whole subtree with `category_path: thisId` and build breadcrumbs.
    category_path: [
      {
        type: Schema.Types.ObjectId,
        ref: "categories",
      },
    ],
    depth: {
      type: Number,
      default: 0,
      index: true,
    },
    // Per-category default theme (previously lived on subcategories).
    default_theme_id: {
      type: Schema.Types.ObjectId,
      ref: "themes",
      default: null,
    },

    // Phase B — attribute suggestions inherited by descendants and used to
    // pre-populate product form / storefront filter sidebar. Resolved with
    // parent-chain merge by resolveCategoryDefaults().
    default_variant_attributes: [
      {
        type: Schema.Types.ObjectId,
        ref: "attributes",
      },
    ],
    default_filter_attributes: [
      {
        type: Schema.Types.ObjectId,
        ref: "attributes",
      },
    ],

    category_publisher_id: {
      type: Schema.Types.ObjectId,
      ref: "admins",
      required: true,
    },
    category_updated_by: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },

    // Demo-seed marker — see product.model.ts. Cleared by "Clear demo data".
    is_demo: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  }
);

const CategoryModel = model<ICategoryInterface>("categories", categorySchema);

export default CategoryModel;
