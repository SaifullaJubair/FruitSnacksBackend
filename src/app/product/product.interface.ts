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
  // Phase 0 fix — source attribute._id snapshot. Without this, the frontend
  // helper `variantAxisAttributes()` cannot reconcile this snapshot row with
  // `variant_axes[].attribute_id`, so the PDP picker never renders. The
  // Mongoose-autogen subdoc `_id` is unrelated and unsafe to use here.
  attribute_id?: Types.ObjectId;
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
  // Batch 2 E6 — per-product override: whether this attribute appears in the
  // storefront filter sidebar. Default true. Owner can untoggle for internal
  // attributes (e.g. Manufacturer) that should remain on the PDP spec table
  // only, not as a filterable facet.
  show_in_filter?: boolean;
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
  product_sku_hash?: string;
  product_status: "active" | "in-active";
  // Phase L: category is OPTIONAL — products can publish without one.
  category_id?: Types.ObjectId | ICategoryInterface;
  category_path?: Types.ObjectId[];
  brand_id?: Types.ObjectId | IBrandInterface;
  attributes_details?: attributesArray[];
  // Structured attribute engine (Phase 1) — drives spec table + filter facets.
  product_attributes?: IProductAttribute[];
  // Which attributes form variation combinations.
  variant_axes?: IVariantAxis[];
  barcode?: string;
  barcode_image?: string;
  barcode_image_key?: string;
  barcode_format?: "CODE128" | "EAN13" | "UPC" | "ITF14" | "CUSTOM";
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

  // ── Phase F: additive fields (cheap; some need logic later, all ready now) ─
  /** YouTube/Vimeo embed URL — ADDITIONAL cheap option alongside main_video upload. */
  video_link?: string;
  /** Item condition. Default "new". Used by storefront filter + reseller flow. */
  condition?: "new" | "used" | "refurbished";
  /** Lifetime units sold — incremented on each successful order placement. */
  sold_count?: number;
  /** Lifetime PDP view count — incremented on storefront PDP fetch. */
  view_count?: number;
  /** Shipping weight (grams) at product level (variations may override). */
  product_weight_grams?: number;
  /** Shipping dimensions in cm. */
  product_dimensions?: { length?: number; width?: number; height?: number };
  /** Friendly free-form spec rows the merchant wants to show beyond attributes. */
  custom_fields?: Array<{ label: string; value: string; icon_key?: string }>;
  /** QR code payload (defaults to product_slug) + generated image URL. */
  qr_code?: string;
  qr_code_image?: string;
  qr_code_image_key?: string;
  qr_code_updated_at?: Date | string;
  qr_short_code?: string;
  /**
   * Product type — what the order/checkout/fulfillment flow should do with
   * this product. `simple` = current single-product behaviour (default);
   * `variable` = uses variation_axes (Phase A); the rest are scaffolds whose
   * fields are present now so the storefront / checkout can be extended later
   * without a model migration.
   */
  product_type?:
    | "simple"
    | "variable"
    | "digital"
    | "combo"
    | "preorder"
    | "subscription";
  /** combo type: child products bundled inside this one. */
  bundle_items?: Array<{
    product_id: Types.ObjectId;
    quantity: number;
  }>;
  /** digital type: download URL + optional license key. */
  download_url?: string;
  license_key?: string;
  /** preorder type: earliest date orders ship. */
  available_from?: Date | string;
  /** subscription type: how often the buyer is billed. */
  billing_interval?: "monthly" | "yearly";

  // Phase E — tier pricing (bulk discount; qty↑ → price↓). Resolver chooses
  // the lowest-applicable tier when the buyer's qty meets `min_qty`. Sorted
  // by min_qty ascending in `recompute` so we can break early.
  tier_prices?: Array<{ min_qty: number; price: number }>;

  // ── Phase H: future-proof field stubs ─────────────────────────────────────
  /** Warehouse this product belongs to (default fallback at runtime). */
  warehouse_id?: Types.ObjectId;
  /** Customer-group prices — wholesale/vip can have a cheaper price than retail. */
  group_prices?: Array<{ group: "wholesale" | "vip"; price: number }>;
  /** Per-product VAT override (beats settings.vat_percentage when present + > 0). */
  vat_percentage_override?: number;
}

export const productSearchableField = [
  "product_name",
  "product_slug",
  "product_status",
  "product_sku",
  "barcode",
  "description",
  "short_description",
  "badge_text",
  "unit",
  "meta_title",
  "meta_description",
  "meta_keywords",
];
