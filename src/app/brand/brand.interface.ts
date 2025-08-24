import { Types } from "mongoose";
import { ICategoryInterface } from "../category/category.interface";
import { IAdminInterface } from "../adminRegLog/admin.interface";

export interface IBrandInterface {
  _id?: any;
  brand_name: string;
  brand_slug: string;
  brand_logo: string;
  brand_logo_key: string;
  brand_status: "active" | "in-active";
  brand_serial: number;
  brand_show?: true | false;
  category_id?: Types.ObjectId | ICategoryInterface;
  brand_publisher_id: Types.ObjectId | IAdminInterface;
  brand_updated_by?: Types.ObjectId | IAdminInterface;
}

export const brandSearchableField = [
  "brand_name",
  "brand_slug",
  "brand_status",
];
