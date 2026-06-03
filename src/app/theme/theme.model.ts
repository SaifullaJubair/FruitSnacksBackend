import { Schema, model } from "mongoose";
import { IThemeInterface } from "./theme.interface";

const floatingAssetSchema = new Schema(
  {
    asset_url: { type: String, required: true },
    asset_key: { type: String, required: true },
    position: { type: String, enum: ["left", "right"], required: true },
    section: {
      type: String,
      enum: [
        "hero",
        "order",
        "benefits",
        "use_cases",
        "nutrition",
        "reviews",
        "faq",
        "any",
      ],
      required: true,
    },
    animation_type: {
      type: String,
      enum: ["float", "spin", "bounce", "sway", "none"],
      default: "float",
    },
    animation_speed: {
      type: String,
      enum: ["slow", "normal", "fast"],
      default: "normal",
    },
    size: {
      type: String,
      enum: ["xs", "sm", "md", "lg"],
      default: "md",
    },
    opacity: { type: Number, min: 0, max: 1, default: 1 },
    hide_on_mobile: { type: Boolean, default: true },
  },
  { _id: false },
);

const themeSchema = new Schema<IThemeInterface>(
  {
    theme_name: { type: String, required: true, trim: true },
    theme_slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    theme_for: { type: String, required: true, trim: true, index: true },
    thumbnail_preview: { type: String },
    thumbnail_preview_key: { type: String },

    status: {
      type: String,
      enum: ["active", "draft", "archived"],
      default: "draft",
      index: true,
    },

    colors: {
      primary: { type: String, required: true },
      page_bg: { type: String, required: true },
      accent: { type: String, required: true },
      primary_light: { type: String, required: true },
      primary_dark: { type: String, required: true },
      heading_text: { type: String, required: true },
      body_text: { type: String, required: true },
      section_bg: { type: String, required: true },
      button_text: { type: String, default: "#FFFFFF" },
    },

    floating_assets: { type: [floatingAssetSchema], default: [] },

    typography: {
      // Legacy single font (kept for back-compat; used as fallback for both
      // heading_font and body_font when those aren't set).
      font_key: { type: String },
      // Two-font system.
      heading_font: { type: String },
      body_font: { type: String },
      heading_weight: {
        type: String,
        enum: ["400", "500", "600", "700"],
        default: "700",
      },
    },

    button_style: {
      border_radius: { type: String, default: "8px" },
      variant: {
        type: String,
        enum: ["filled", "outlined", "gradient"],
        default: "filled",
      },
    },

    preview_data: {
      type: {
        product_name: String,
        short_description: String,
        price: Number,
        discount_price: Number,
        image_url: String,
      },
      default: undefined,
      _id: false,
    },

    used_in_products: { type: Number, default: 0 },
    is_deletable: { type: Boolean, default: true },
    preview_approved: { type: Boolean, default: false },
    approved_by: { type: Schema.Types.ObjectId, ref: "admins" },
    approved_at: { type: Date },
    created_by: { type: Schema.Types.ObjectId, ref: "admins" },
    updated_by: { type: Schema.Types.ObjectId, ref: "admins" },
  },
  { timestamps: true },
);

const ThemeModel = model<IThemeInterface>("themes", themeSchema);
export default ThemeModel;
