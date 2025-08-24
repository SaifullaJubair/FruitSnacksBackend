import { Types } from "mongoose";
import { IProductInterface } from "../product/product.interface";
import { IAdminInterface } from "../adminRegLog/admin.interface";
import { IUserInterface } from "../user/user.interface";

export interface IReviewInterface {
  _id?: any;
  review_description: string;
  review_answer?: string;
  review_image?: string;
  review_ratting: number;
  review_status: "active" | "in-active";
  review_product_id: Types.ObjectId | IProductInterface;
  review_user_id: Types.ObjectId | IUserInterface;
  review_updated_by?: Types.ObjectId | IAdminInterface;
}

export const reviewSearchableField = [
  "review_status",
  "review_description",
  "review_product_id",
  "review_product_publisher_id",
  "review_user_id",
];
