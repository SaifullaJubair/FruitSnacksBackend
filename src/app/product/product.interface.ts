import { Types } from "mongoose";
import { ICategoryInterface } from "../category/category.interface";
import { IBrandInterface } from "../brand/brand.interface";
import { IAdminInterface } from "../adminRegLog/admin.interface";
import { ICampaignInterface } from "../campaign/campaign.interface";
import { ISupplierInterface } from "../supplier/supplier.interface";

interface attribute_valuesArray {
  attribute_value_name?: string;
  attribute_value_code?: string;
}

export interface attributesArray {
  attribute_name?: string;
  attribute_values?: attribute_valuesArray[];
}

// ── Structured attribute engine (Phase 1) ──────────────────────────────────
// One source of truth = the `attributes` collection. A product links to chosen
// attribute values by id; this drives BOTH the PDP spec table AND the filter
// facets (so sidebar + match never desync). Distinct from the legacy free-text
// `attributes_details` snapshot above (kept for display until consumers migrate).
export interface IProductAttribute {
  attribute_id?: Types.ObjectId; // → attributes._id
  value_ids?: Types.ObjectId[]; // → attributes.attribute_values[]._id (chosen)
}

// Which attributes drive variation combinations (a subset of product_attributes).
// e.g. RAM + Color are axes; "Warranty: 1yr" may be a spec-only attribute.
export interface IVariantAxis {
  attribute_id?: Types.ObjectId; // → attributes._id
  is_mandatory?: boolean; // must the buyer pick a value on this axis?
}

export interface otherimagesArray {
  other_image?: string;
  other_image_key?: string;
}

export interface metakeywordssArray {
  keyword?: string;
}

export interface IconTextItem {
  icon_url?: string;
  icon_key?: string;
  text?: string;
}

export interface INutritionRow {
  label?: string;
  value?: string;
}

export interface INutritionInfoTile {
  label?: string;
  value?: string;
  icon_key?: string;
}

export interface IProductNutrition {
  per_serving?: string; // optional heading suffix (e.g. "প্রতি ১০০g")
  rows?: INutritionRow[]; // free-form nutrient table
  info_tiles?: INutritionInfoTile[]; // free-form info tiles (label+value+icon)
}

export interface IProductFaq {
  question: string;
  answer: string;
}

export interface IProductFloatingImage {
  asset_url?: string;
  asset_key?: string;
  vertical?: string; // "10".."85" or "" for auto
  side?: "left" | "right";
  layer?: "behind" | "front";
  size?: "sm" | "md" | "lg";
}

export interface IProductThemeOverrides {
  colors?: {
    primary?: string;
    page_bg?: string;
    accent?: string;
  };
  button_style?: {
    border_radius?: string;
    variant?: "filled" | "outlined" | "gradient";
  };
}

export interface IProductInterface {
  _id?: any;
  product_name: string;
  product_slug: string;
  product_slug_history?: string[];
  product_sku?: string;
  product_status: "active" | "in-active";
  category_id: Types.ObjectId | ICategoryInterface;
  category_path?: Types.ObjectId[];
  brand_id?: Types.ObjectId | IBrandInterface;
  attributes_details?: attributesArray[];
  // Structured attribute engine (Phase 1) — drives spec table + filter facets.
  product_attributes?: IProductAttribute[];
  // Which attributes form variation combinations.
  variant_axes?: IVariantAxis[];
  barcode?: string;
  barcode_image?: string;
  description: string;
  main_image?: string;
  main_image_key?: string;
  size_chart?: string;
  size_chart_key?: string;
  main_video?: string;
  main_video_key?: string;
  other_images?: otherimagesArray[];
  product_price?: number;
  product_buying_price?: number;
  product_discount_price?: number;
  product_quantity?: number;
  product_alert_quantity?: number;
  is_variation?: true | false;
  product_warrenty?: string;
  product_return?: string;
  unit?: string;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: metakeywordssArray[];
  product_publisher_id: Types.ObjectId | IAdminInterface;
  product_updated_by?: Types.ObjectId | IAdminInterface;
  product_campaign_id?: Types.ObjectId | ICampaignInterface;
  product_supplier_id?: Types.ObjectId | ISupplierInterface;
  trending_product: true | false;

  // Dynamic theming
  theme_id?: Types.ObjectId;
  theme_overrides?: IProductThemeOverrides;

  // Hero
  short_description?: string;
  badge_text?: string;
  hero_corner_badge?: string;
  video_title?: string;
  benefits_side_image?: string;
  benefits_side_image_key?: string;
  use_cases_side_image?: string;
  use_cases_side_image_key?: string;
  faq_side_image?: string;
  faq_side_image_key?: string;

  // Below-hero icon rows (max 4)
  short_features?: IconTextItem[];
  process_steps?: IconTextItem[];

  // Sections
  benefits?: string[];
  use_cases?: IconTextItem[];
  nutrition?: IProductNutrition;
  faqs?: IProductFaq[];
  floating_images?: IProductFloatingImage[];

  // Open Graph
  og_image?: string;
  og_image_key?: string;
  og_title?: string;
  og_description?: string;
}

export const productSearchableField = [
  "product_name",
  "product_slug",
  "product_status",
  "description",
  "short_description",
  "badge_text",
  "unit",
  "meta_title",
  "meta_description",
  "meta_keywords",
];
