import { Types } from "mongoose";
import { ICategoryInterface } from "../category/category.interface";
import { ISubCategoryInterface } from "../sub_category/sub_category.interface";
import { IAdminInterface } from "../adminRegLog/admin.interface";

export interface IChildCategoryInterface {
  _id?: any;
  child_category_name: string;
  child_category_slug: string;
  child_category_status: "active" | "in-active";
  child_category_serial: number;
  category_id: Types.ObjectId | ICategoryInterface;
  sub_category_id: Types.ObjectId | ISubCategoryInterface;
  child_category_publisher_id: Types.ObjectId | IAdminInterface;
  child_category_updated_by?: Types.ObjectId | IAdminInterface;
}

export const childcategorySearchableField = [
  "child_category_name",
  "child_category_slug",
  "child_category_status",
];
