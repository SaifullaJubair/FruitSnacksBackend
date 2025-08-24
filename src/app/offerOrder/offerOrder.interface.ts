import { Types } from "mongoose";
import { IUserInterface } from "../user/user.interface";
import { IAdminInterface } from "../adminRegLog/admin.interface";
import { IOfferInterface } from "../offer/offer.interface";
import { IProductInterface } from "../product/product.interface";
import { IVariationInterface } from "../variation/variation.interface";

interface IOfferOrderProducts {
  offer_product_id: Types.ObjectId | IProductInterface;
  offer_product_main_price: number;
  offer_product_main_discount_price: number;
  offer_product_price: number;
  offer_product_quantity: number;
  offer_discount_price: number;
  offer_discount_type: "fixed" | "percent";
  is_variation: true | false;
  variation_id?: Types.ObjectId | IVariationInterface;
}

export interface IOfferOrderInterface {
  _id?: any;
  invoice_id: string;
  order_status:
    | "pending"
    | "processing"
    | "shipped"
    | "delivered"
    | "cancel"
    | "return";
  pending_time?: string;
  processing_time?: string;
  shipped_time?: string;
  delivered_time?: string;
  cancel_time?: string;
  return_time?: string;
  billing_country: string;
  billing_city: string;
  billing_state: string;
  billing_address: string;
  product_total_amount: number;
  discount_amount: number;
  sub_total_amount: number;
  shipping_cost: number;
  shipping_location: string;
  grand_total_amount: number;
  customer_id: Types.ObjectId | IUserInterface;
  customer_phone: string;
  order_updated_by?: Types.ObjectId | IAdminInterface;
  offer_id: Types.ObjectId | IOfferInterface;
  offer_products?: IOfferOrderProducts[];
}

export const offerOrderSearchableField = [
  "invoice_id",
  "order_status",
  "customer_phone",
];
