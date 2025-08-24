import { Types } from "mongoose";
import { ICategoryInterface } from "../category/category.interface";
import { IAdminInterface } from "../adminRegLog/admin.interface";

export interface attributeValuesArray {
  attribute_value_name: string;
  attribute_value_slug: string;
  attribute_value_code?: string;
  _id?: any;
  attribute_value_status: "active" | "in-active";
}

export interface IAttributeInterface {
  _id?: any;
  attribute_name: string;
  attribute_slug: string;
  attribute_status: "active" | "in-active";
  category_id?: Types.ObjectId | ICategoryInterface;
  attribute_values: attributeValuesArray[];
  attribute_publisher_id: Types.ObjectId | IAdminInterface;
  attribute_updated_by?: Types.ObjectId | IAdminInterface;
}

export const attributeSearchableField = [
  "attribute_name",
  "attribute_slug",
  "attribute_status",
];
