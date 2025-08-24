import { Types } from "mongoose";
import { IProductInterface } from "../product/product.interface";
import { IAdminInterface } from "../adminRegLog/admin.interface";

interface IOfferProducts {
  offer_product_id: Types.ObjectId | IProductInterface;
  offer_product_quantity: number;
  offer_discount_price: number;
  offer_discount_type: "fixed" | "percent";
}

export interface IOfferInterface {
  toObject(): unknown;
  _id?: any;
  offer_image: string;
  offer_image_key?: string;
  offer_start_date: string;
  offer_end_date: string;
  offer_title: string;
  offer_description?: string;
  offer_products?: IOfferProducts[];
  offer_status: "active" | "in-active";
  offer_publisher_id: Types.ObjectId | IAdminInterface;
  offer_updated_by?: Types.ObjectId | IAdminInterface;
}

export const offerSearchableField = [
  "offer_title",
  "offer_description",
  "offer_status",
  "offer_start_date",
  "offer_end_date",
];
