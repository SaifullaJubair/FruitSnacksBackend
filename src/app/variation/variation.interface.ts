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
  variation_image?: string;
  variation_image_key?: string;
  variation_video?: string;
  variation_video_key?: string;
  variation_sku?: string;

  // Dynamic Product Page System
  variation_weight_grams?: number | null;
  variation_badge_text?: string | null;

  // ── Combination-stock engine (Phase 1, additive) ──
  // A variation is one COMBINATION of attribute values, e.g. RAM=8GB + Color=Black.
  // `combination` = sorted array of attribute_values._id (D2: sorted for stable
  // equality/lookups, matches ZatiqEasy product_stocks). Final price is resolved
  // (Phase 3) as base price + variation_price_delta. The legacy fields above
  // (variation_name/price/quantity) are kept until cart/order/courier migrate.
  combination?: Types.ObjectId[];
  variation_price_delta?: number;
  is_active?: boolean;
}
