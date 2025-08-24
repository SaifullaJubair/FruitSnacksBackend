import { Types } from "mongoose";
import { ICategoryInterface } from "../category/category.interface";
import { ISubCategoryInterface } from "../sub_category/sub_category.interface";
import { IAdminInterface } from "../adminRegLog/admin.interface";

export interface specificationValuesArray {
  specification_value_name: string;
  specification_value_slug: string;
  _id?: any;
  specification_value_status: "active" | "in-active";
}

export interface ISpecificationInterface {
  _id?: any;
  specification_name: string;
  specification_slug: string;
  specification_serial: number;
  specification_status: "active" | "in-active";
  specification_show: true | false;
  category_id: Types.ObjectId | ICategoryInterface;
  sub_category_id?: Types.ObjectId | ISubCategoryInterface;
  specification_values: specificationValuesArray[];
  specification_publisher_id: Types.ObjectId | IAdminInterface;
  specification_updated_by?: Types.ObjectId | IAdminInterface;
}

export const specificationSearchableField = [
  "specification_name",
  "specification_slug",
  "specification_status",
];
