import { Types } from "mongoose";

export type ThemeStatus = "active" | "draft" | "archived";

export type FloatingAssetSection =
  | "hero"
  | "order"
  | "benefits"
  | "use_cases"
  | "nutrition"
  | "reviews"
  | "faq"
  | "any";

export type FloatingAssetAnimation =
  | "float"
  | "spin"
  | "bounce"
  | "sway"
  | "none";

export type FloatingAssetSpeed = "slow" | "normal" | "fast";

export type FloatingAssetSize = "xs" | "sm" | "md" | "lg";

export type FloatingAssetAlign = "top" | "middle" | "bottom";

export type FontKey =
  | "hind-siliguri"
  | "tiro-bangla"
  | "noto-sans-bengali"
  | "baloo-da-2"
  | "mina";

export type FontWeight = "400" | "500" | "600" | "700";

export type FontStyleKind = "rounded" | "sharp" | "elegant" | "bold";

export type ButtonVariant = "filled" | "outlined" | "gradient";

export interface IThemeColors {
  primary: string;
  page_bg: string;
  accent: string;
  primary_light: string;
  primary_dark: string;
  heading_text: string;
  body_text: string;
  section_bg: string;
  button_text: string;
}

export interface IFloatingAsset {
  // Stable per-asset id (uuid). Lets a product-level override target THIS
  // asset to hide/replace it. Auto-generated on create/update when missing
  // (legacy theme assets get one via the floating migration / save hook).
  id: string;
  asset_url: string;
  asset_key: string;
  position: "left" | "right";
  // Vertical placement WITHIN the anchored section (section is the anchor;
  // align positions the asset inside that section's box). Defaults "middle".
  align: FloatingAssetAlign;
  section: FloatingAssetSection;
  animation_type: FloatingAssetAnimation;
  animation_speed: FloatingAssetSpeed;
  size: FloatingAssetSize;
  opacity: number;
  hide_on_mobile: boolean;
}

export interface IThemeTypography {
  font_key?: FontKey | string; // legacy single font (back-compat fallback)
  heading_font?: string; // two-font system
  body_font?: string;
  heading_weight: FontWeight;
  style?: FontStyleKind; // deprecated, unused
}

export interface IThemeButtonStyle {
  border_radius: string;
  variant: ButtonVariant;
}

export interface IThemePreviewData {
  product_name?: string;
  short_description?: string;
  price?: number;
  discount_price?: number;
  image_url?: string;
}

export interface IThemeInterface {
  _id?: Types.ObjectId;
  theme_name: string;
  theme_slug: string;
  theme_for: string;
  thumbnail_preview?: string;
  thumbnail_preview_key?: string;
  status: ThemeStatus;

  colors: IThemeColors;
  floating_assets: IFloatingAsset[];
  typography: IThemeTypography;
  button_style: IThemeButtonStyle;
  preview_data?: IThemePreviewData;

  used_in_products: number;
  is_deletable: boolean;
  preview_approved: boolean;
  approved_by?: Types.ObjectId;
  approved_at?: Date;
  created_by?: Types.ObjectId;
  updated_by?: Types.ObjectId;

  // Demo-seed marker — KEPT by "Clear demo data" (label-only). See theme.model.ts.
  is_demo?: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const themeSearchableFields = ["theme_name", "theme_for", "theme_slug"];
