import { Types } from "mongoose";
import { attributeValuesArray, IAttributeInterface } from "../attribute/attribute.interface";
import { IProductInterface } from "../product/product.interface";

export interface IVariationInterface {
  _id?: any;
  variation_name: string;
  product_id: Types.ObjectId | IProductInterface;
  variation_price: number;
  variation_discount_price?: number;
  variation_buying_price?: number;
  variation_quantity: number;
  variation_alert_quantity?: number;
  variation_barcode?: string;
  variation_barcode_image?: string;
  variation_barcode_image_key?: string;
  variation_barcode_format?: "CODE128" | "EAN13" | "UPC" | "ITF14" | "CUSTOM";
  variation_image?: string;        // legacy single
  variation_image_key?: string;    // legacy single
  variation_images?: string[];      // multi-image gallery (first = primary)
  variation_images_keys?: string[]; // matching S3 keys for cleanup
  variation_video?: string;
  variation_video_key?: string;
  variation_sku?: string;

  // Dynamic Product Page System
  variation_weight_grams?: number | null;
  variation_badge_text?: string | null;
  /**
   * A4 (2026-06-04) — curated IconPicker key (e.g. "lu:Crown") shown next to
   * the badge text on the PDP variation swatch. Badge bg color = active theme
   * primary always (no per-badge color override) so PDP stays visually
   * cohesive. Stored as a string so any picker key shape works.
   */
  variation_badge_icon_key?: string | null;

  // ── Combination-stock engine (Phase 1, additive) ──
  // A variation is one COMBINATION of attribute values, e.g. RAM=8GB + Color=Black.
  // `combination` = sorted array of attribute_values._id (D2: sorted for stable
  // equality/lookups, matches ZatiqEasy product_stocks). Final price is resolved
  // (Phase 3) as base price + variation_price_delta. The legacy fields above
  // (variation_name/price/quantity) are kept until cart/order/courier migrate.
  combination?: Types.ObjectId[];
  variation_price_delta?: number;
  is_active?: boolean;

  // ── Phase H: optional warehouse override per variation (multi-warehouse
  // stock placement). Null = inherits the product's warehouse_id.
  warehouse_id?: Types.ObjectId;
}
