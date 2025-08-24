import { Types } from "mongoose";
import { ICategoryInterface } from "../category/category.interface";
import { IAdminInterface } from "../adminRegLog/admin.interface";

export interface ISubCategoryInterface {
  _id?: any;
  sub_category_name: string;
  sub_category_slug: string;
  sub_category_logo: string;
  sub_category_logo_key: string;
  sub_category_status: "active" | "in-active";
  sub_category_serial: number;
  category_id: Types.ObjectId | ICategoryInterface;
  sub_category_publisher_id: Types.ObjectId | IAdminInterface;
  sub_category_updated_by?: Types.ObjectId | IAdminInterface;
}

export const subcategorySearchableField = [
  "sub_category_name",
  "sub_category_slug",
  "sub_category_status",
];
