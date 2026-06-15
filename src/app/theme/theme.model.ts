import { Schema, model } from "mongoose";
import { randomUUID } from "crypto";
import { IThemeInterface } from "./theme.interface";

const floatingAssetSchema = new Schema(
  {
    // Stable id so product-level overrides can target this asset (hide/replace).
    // Auto-filled when missing — covers legacy assets + admin payloads that
    // don't send an id.
    id: { type: String, default: () => randomUUID() },
    asset_url: { type: String, required: true },
    asset_key: { type: String, required: true },
    position: { type: String, enum: ["left", "right"], required: true },
    // Vertical placement inside the anchored section.
    align: {
      type: String,
      enum: ["top", "middle", "bottom"],
      default: "middle",
    },
    // MULTI-NICHE-DEBT: section enum hardcoded food (hero/order/benefits/use_cases/
    // nutrition/reviews/faq). When the PDP section registry + pdp_section_array lands,
    // derive this list from the active niche's section registry instead.
    // See docs/_ai/MULTI_NICHE_PLAN.md §4. Mirror change in product.model.ts +
    // FloatingAssets.jsx + ThemeFloatingManager.jsx + ProductFloatingTab.jsx.
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

    // Demo-seed marker. Set true for themes created by `npm run seed:demo`.
    // Unlike the catalog, "Clear demo data" KEEPS these themes (the client may
    // want to keep using a nice demo theme); the flag only lets the admin tell
    // demo themes apart from ones they built themselves.
    is_demo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

const ThemeModel = model<IThemeInterface>("themes", themeSchema);
export default ThemeModel;
