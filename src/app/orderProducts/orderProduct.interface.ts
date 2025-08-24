import { Types } from "mongoose";
import { IOrderInterface } from "../order/order.interface";
import { IProductInterface } from "../product/product.interface";
import { IVariationInterface } from "../variation/variation.interface";
import { ICampaignInterface } from "../campaign/campaign.interface";
import { IUserInterface } from "../user/user.interface";

export interface IOrderProductInterface {
  _id?: any;
  order_id: Types.ObjectId | IOrderInterface;
  invoice_id: string;
  product_id: Types.ObjectId | IProductInterface;
  variation_id?: Types.ObjectId | IVariationInterface;
  product_unit_price: number;
  product_unit_final_price: number;
  product_quantity: number;
  product_grand_total_price: number;
  campaign_id?: Types.ObjectId | ICampaignInterface;
  customer_id: Types.ObjectId | IUserInterface;
  product_main_price: number;
  product_main_discount_price: number;
}

export const orderProductSearchableField = ["invoice_id"];
