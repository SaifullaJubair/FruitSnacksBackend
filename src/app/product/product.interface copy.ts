import { Types } from "mongoose";
import { ICategoryInterface } from "../category/category.interface";
import { ISubCategoryInterface } from "../sub_category/sub_category.interface";
import { IChildCategoryInterface } from "../child_category/child_category.interface";
import { IBrandInterface } from "../brand/brand.interface";
import { IAdminInterface } from "../adminRegLog/admin.interface";
import { ICampaignInterface } from "../campaign/campaign.interface";
import { ISupplierInterface } from "../supplier/supplier.interface";
import {
  attributeValuesArray,
  IAttributeInterface,
} from "../attribute/attribute.interface";

interface attribute_valuesArray {
  attribute_value_name?: string;
  attribute_value_code?: string;
}

export interface attributesArray {
  attribute_name?: string;
  attribute_values?: attribute_valuesArray[];
}

interface specification_valuesArray {
  specification_value_id?: Types.ObjectId | attributeValuesArray;
}

export interface specificationsArray {
  specification_id?: Types.ObjectId | IAttributeInterface;
  specification_values?: specification_valuesArray[];
}

export interface otherimagesArray {
  other_image?: string;
  other_image_key?: string;
}

export interface metakeywordssArray {
  keyword?: string;
}

export interface IProductInterface {
  _id?: any;
  product_name: string;
  product_slug: string;
  product_sku?: string;
  product_status: "active" | "in-active";
  category_id: Types.ObjectId | ICategoryInterface;
  sub_category_id?: Types.ObjectId | ISubCategoryInterface;
  child_category_id?: Types.ObjectId | IChildCategoryInterface;
  brand_id?: Types.ObjectId | IBrandInterface;
  specifications?: specificationsArray[];
  attributes_details?: attributesArray[];
  barcode?: string;
  barcode_image?: string;
  description: string;
  main_image?: string;
  main_image_key?: string;
  size_chart?: string;
  size_chart_key?: string;
  main_video?: string;
  main_video_key?: string;
  other_images?: otherimagesArray[];
  product_price?: number;
  product_buying_price?: number;
  product_discount_price?: number;
  product_quantity?: number;
  product_alert_quantity?: number;
  is_variation?: true | false;
  product_warrenty?: string;
  product_return?: string;
  unit?: string;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: metakeywordssArray[];
  product_publisher_id: Types.ObjectId | IAdminInterface;
  product_updated_by?: Types.ObjectId | IAdminInterface;
  product_campaign_id?: Types.ObjectId | ICampaignInterface;
  product_supplier_id?: Types.ObjectId | ISupplierInterface;
  trending_product: true | false;
}

export const productSearchableField = [
  "product_name",
  "product_slug",
  "product_status",
  "description",
  "unit",
  "meta_title",
  "meta_description",
  "meta_keywords",
];
