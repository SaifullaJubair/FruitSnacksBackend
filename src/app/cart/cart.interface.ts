import { Types } from "mongoose";

export interface ICartProduct {
  product_id: Types.ObjectId;
  variation_id?: Types.ObjectId | null;
  quantity: number;
}

export interface ICartInterface {
  _id?: Types.ObjectId;
  cart_user_id: Types.ObjectId;
  cart_products: ICartProduct[];
  createdAt?: Date;
  updatedAt?: Date;
}
