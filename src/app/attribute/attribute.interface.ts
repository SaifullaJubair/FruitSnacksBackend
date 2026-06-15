import { Types } from "mongoose";
import { ICategoryInterface } from "../category/category.interface";
import { IAdminInterface } from "../adminRegLog/admin.interface";

export interface attributeValuesArray {
  attribute_value_name: string;
  attribute_value_slug: string;
  attribute_value_code?: string;
  _id?: any;
  attribute_value_status: "active" | "in-active";
  // Phase A: per-value weight in grams. Only meaningful when the parent
  // attribute has tracks_weight=true; ignored otherwise. Variation matrix
  // sums this across every tracks_weight axis in a row's combination to
  // auto-fill variation_weight_grams (for new rows only — existing rows
  // preserve their saved weight).
  weight_grams_value?: number | null;
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
  // Phase A: how this attribute renders in admin + storefront. Drives the
  // PDP picker (Phase C) and the filter sidebar (Phase B).
  display_type?: "swatch" | "button" | "dropdown";
  // Phase A: marks attributes whose values carry weight (e.g. Size, Pack).
  // Variation matrix auto-fills variation_weight_grams from these.
  tracks_weight?: boolean;

  // Demo-seed marker — cleared by "Clear demo data".
  is_demo?: boolean;
}

export const attributeSearchableField = [
  "attribute_name",
  "attribute_slug",
  "attribute_status",
];
