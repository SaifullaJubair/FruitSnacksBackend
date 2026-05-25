import { Types } from "mongoose";
import ApiError from "../../errors/ApiError";
import {
  ICategoryInterface,
  categorySearchableField,
} from "./category.interface";
import CategoryModel from "./category.model";
import ProductModel from "../product/product.model";

// ──────────────────────────────────────────────────────────────────────────
// Nested-tree helpers
// ──────────────────────────────────────────────────────────────────────────

// Resolve depth + category_path for a node from its parent_id.
// Root (no parent) → depth 0, empty path. Child → parent.depth+1 and
// parent.category_path + [parent._id].
const resolveTreePosition = async (
  parent_id?: Types.ObjectId | string | null
): Promise<{ parent_id: Types.ObjectId | null; depth: number; category_path: Types.ObjectId[] }> => {
  if (!parent_id) {
    return { parent_id: null, depth: 0, category_path: [] };
  }
  const parent = await CategoryModel.findById(parent_id)
    .select("_id depth category_path")
    .lean();
  if (!parent) {
    throw new ApiError(400, "Parent category not found");
  }
  return {
    parent_id: parent._id as Types.ObjectId,
    depth: (parent.depth ?? 0) + 1,
    category_path: [...(parent.category_path ?? []), parent._id as Types.ObjectId],
  };
};

// Create A Category (parent-aware: auto-computes depth + category_path)
export const postCategoryServices = async (
  data: ICategoryInterface
): Promise<ICategoryInterface | {}> => {
  const position = await resolveTreePosition(data.parent_id as any);
  const createCategory: ICategoryInterface | {} = await CategoryModel.create({
    ...data,
    parent_id: position.parent_id,
    depth: position.depth,
    category_path: position.category_path,
  });
  return createCategory;
};

// Build the full category tree (root nodes with nested children, infinite depth).
// One DB read of all active categories, assembled into a tree in memory —
// avoids recursive lookups. Each node gets a `children: []` array.
export const getCategoryTreeServices = async (): Promise<any[]> => {
  const all = await CategoryModel.find({ category_status: { $ne: "in-active" } })
    .sort({ category_serial: 1 })
    .select("-__v")
    .lean();

  const byId = new Map<string, any>();
  all.forEach((c: any) => {
    c.children = [];
    byId.set(String(c._id), c);
  });

  const roots: any[] = [];
  all.forEach((c: any) => {
    const parentKey = c.parent_id ? String(c.parent_id) : null;
    if (parentKey && byId.has(parentKey)) {
      byId.get(parentKey).children.push(c);
    } else {
      roots.push(c);
    }
  });

  return roots;
};

// Direct children of one node (drill-down, one level). parentId null/"root"
// returns the root-level categories.
export const getCategoryChildrenServices = async (
  parentId: string | null
): Promise<ICategoryInterface[] | []> => {
  const match =
    !parentId || parentId === "root"
      ? { parent_id: null }
      : { parent_id: new Types.ObjectId(parentId) };
  return CategoryModel.find({ ...match, category_status: { $ne: "in-active" } })
    .sort({ category_serial: 1 })
    .select("-__v")
    .lean();
};

// Breadcrumb / ancestors for a node: the node plus its ancestors resolved from
// category_path, ordered root → … → node.
export const getCategoryBreadcrumbServices = async (
  _id: string
): Promise<ICategoryInterface[]> => {
  const node = await CategoryModel.findById(_id).select("-__v").lean();
  if (!node) {
    throw new ApiError(404, "Category not found");
  }
  const ancestorIds = (node as any).category_path ?? [];
  let ancestors: any[] = [];
  if (ancestorIds.length) {
    const docs = await CategoryModel.find({ _id: { $in: ancestorIds } })
      .select("-__v")
      .lean();
    // Preserve category_path order (find() does not guarantee it).
    const map = new Map(docs.map((d: any) => [String(d._id), d]));
    ancestors = ancestorIds
      .map((id: Types.ObjectId) => map.get(String(id)))
      .filter(Boolean);
  }
  return [...ancestors, node];
};

// Featured categories (homepage). Root-level featured nodes, each with their
// immediate children for the menu/section. Endpoint name kept for the frontend.
export const getSixFeaturedCategoryServices = async (): Promise<any[]> => {
  const featured = await CategoryModel.find({
    category_status: { $ne: "in-active" },
    feature_category_show: true,
  })
    .sort({ category_serial: 1 })
    .select("-__v")
    .lean();

  if (!featured.length) return [];

  const featuredIds = featured.map((c: any) => c._id);
  const children = await CategoryModel.find({
    parent_id: { $in: featuredIds },
    category_status: { $ne: "in-active" },
  })
    .sort({ category_serial: 1 })
    .select("-__v")
    .lean();

  const childrenByParent = new Map<string, any[]>();
  children.forEach((c: any) => {
    const key = String(c.parent_id);
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key)!.push(c);
  });

  return featured.map((c: any) => ({
    ...c,
    children: childrenByParent.get(String(c._id)) ?? [],
  }));
};

// Find Category (flat list, active)
export const findAllCategoryServices = async (): Promise<
  ICategoryInterface[] | []
> => {
  const findCategory: ICategoryInterface[] | [] = await CategoryModel.find({
    category_status: "active",
  })
    .sort({ category_serial: 1 })
    .select("-__v");
  return findCategory;
};

// Find all dashboard Category
export const findAllDashboardCategoryServices = async (
  limit: number,
  skip: number,
  searchTerm: any
): Promise<ICategoryInterface[] | []> => {
  const andCondition = [];
  if (searchTerm) {
    andCondition.push({
      $or: categorySearchableField.map((field) => ({
        [field]: {
          $regex: searchTerm,
          $options: "i",
        },
      })),
    });
  }
  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};
  const findCategory: ICategoryInterface[] | [] = await CategoryModel.find(
    whereCondition
  )
    .sort({ category_serial: 1 })
    .skip(skip)
    .limit(limit)
    .select("-__v");
  return findCategory;
};

// Update a Category
export const updateCategoryServices = async (
  data: ICategoryInterface,
  _id: string
): Promise<ICategoryInterface | any> => {
  const updateCategoryInfo: ICategoryInterface | null =
    await CategoryModel.findOne({ _id: _id });
  if (!updateCategoryInfo) {
    return {};
  }
  const Category = await CategoryModel.updateOne({ _id: _id }, data, {
    runValidators: true,
  });
  return Category;
};

// Delete a Category
export const deleteCategoryServices = async (
  _id: string
): Promise<ICategoryInterface | any> => {
  const updateCategoryInfo: ICategoryInterface | null =
    await CategoryModel.findOne({ _id: _id });
  if (!updateCategoryInfo) {
    throw new ApiError(404, "Category not found");
  }
  const Category = await CategoryModel.deleteOne(
    { _id: _id },
    {
      runValidators: true,
    }
  );
  return Category;
};

// Tree-integrity guards used before deleting a node.
export const categoryHasChildrenServices = async (
  _id: string
): Promise<boolean> => {
  return !!(await CategoryModel.exists({ parent_id: _id }));
};

export const categoryHasProductsServices = async (
  _id: string
): Promise<boolean> => {
  return !!(await ProductModel.exists({ category_id: _id }));
};
