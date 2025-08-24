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
}
