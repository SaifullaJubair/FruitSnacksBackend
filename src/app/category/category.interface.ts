import { Types } from "mongoose";
import { IAdminInterface } from "../adminRegLog/admin.interface";

export interface ICategoryInterface {
  _id?: any;
  category_name: string;
  category_slug: string;
  category_logo?: string;
  category_logo_key?: string;
  category_video?: string;
  category_video_key?: string;
  category_status: "active" | "in-active";
  category_serial: number;
  feature_category_show?: true | false;
  explore_category_show?: true | false;

  // ── Nested category tree (self-referencing, infinite depth) ──
  // parent_id = NULL → root level. category_path = ordered list of ancestor
  // ids (root → ...→ immediate parent), enabling fast subtree filtering and
  // breadcrumbs without recursive lookups. depth = path length (0 = root).
  parent_id?: Types.ObjectId | ICategoryInterface | null;
  category_path?: Types.ObjectId[];
  depth?: number;

  // Optional per-category default theme (was on subcategories before).
  default_theme_id?: Types.ObjectId | null;

  // Phase B — category-level attribute suggestions. Resolved on-the-fly by
  // resolveCategoryDefaults() with parent-chain merge (Daraz/Amazon pattern).
  // Empty arrays = inherit-only from parent.
  default_variant_attributes?: Types.ObjectId[];
  default_filter_attributes?: Types.ObjectId[];

  category_publisher_id: Types.ObjectId | IAdminInterface;
  category_updated_by?: Types.ObjectId | IAdminInterface;

  // Demo-seed marker — cleared by "Clear demo data".
  is_demo?: boolean;
}

export const categorySearchableField = [
  "category_name",
  "category_slug",
  "category_status",
];
