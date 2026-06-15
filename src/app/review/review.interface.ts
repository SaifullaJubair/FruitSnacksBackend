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
  review_status: "active" | "in-active" | "pending";
  review_product_id: Types.ObjectId | IProductInterface;
  review_user_id?: Types.ObjectId | IUserInterface;
  review_updated_by?: Types.ObjectId | IAdminInterface;
  // Sprint 3 — seed review fields
  is_seeded?: boolean;
  // "demo_seed" = created by `npm run seed:demo`; the demo clear removes reviews
  // by THIS source (not by is_seeded), so a client's real csv_bulk/manual_admin
  // seeded reviews are never wiped by "Clear demo data".
  source?: "customer" | "csv_bulk" | "manual_admin" | "demo_seed";
  reviewer_name?: string;
  reviewer_verified?: boolean;
}

export const reviewSearchableField = [
  "review_status",
  "review_description",
  "review_product_id",
  "review_product_publisher_id",
  "review_user_id",
];
