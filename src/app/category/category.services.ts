import { Types } from "mongoose";
import ApiError from "../../errors/ApiError";
import {
  ICategoryInterface,
  categorySearchableField,
} from "./category.interface";
import CategoryModel from "./category.model";
import ProductModel from "../product/product.model";
import AttributeModel from "../attribute/attribute.model";

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
//
// Phase D Bug #6: when `includeInactive=true` is passed (admin product form),
// inactive categories are also returned so the picker can render them as
// disabled/greyed-out instead of hiding them silently. Public consumers
// (storefront filter, etc.) keep the default active-only behavior.
export const getCategoryTreeServices = async (
  includeInactive = false,
): Promise<any[]> => {
  const all = await CategoryModel.find(
    includeInactive ? {} : { category_status: { $ne: "in-active" } },
  )
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

// ──────────────────────────────────────────────────────────────────────────
// Phase B — Category default attribute resolver
// ──────────────────────────────────────────────────────────────────────────

// Walks the parent chain (current → root) and merges default_variant_attributes
// and default_filter_attributes with parent-first, dedup-by-id, first-occurrence
// semantics. Self-healing: dead refs (attributes that were deleted but linger
// in arrays) are filtered out at the end so the admin form / sidebar never
// renders orphans.
//
// Safety nets:
//   - visited Set breaks circular parent refs (A→B→A)
//   - 10-level cap as belt-and-suspenders
//   - dead-ref skip via single $in fetch against attribute collection
export const resolveCategoryDefaults = async (
  categoryId: string | Types.ObjectId,
): Promise<{
  default_variant_attributes: any[];
  default_filter_attributes: any[];
}> => {
  const visited = new Set<string>();
  const chain: Array<{
    variants: Types.ObjectId[];
    filters: Types.ObjectId[];
  }> = [];

  let cursorId: Types.ObjectId | string | null = categoryId;
  let safety = 0;
  while (cursorId && safety < 10) {
    const key = String(cursorId);
    if (visited.has(key)) break;
    visited.add(key);

    const node: any = await CategoryModel.findById(cursorId)
      .select(
        "_id parent_id default_variant_attributes default_filter_attributes",
      )
      .lean();
    if (!node) break;

    chain.push({
      variants: (node.default_variant_attributes || []) as Types.ObjectId[],
      filters: (node.default_filter_attributes || []) as Types.ObjectId[],
    });
    cursorId = node.parent_id || null;
    safety += 1;
  }

  // Parent-first then own — chain is current→root, so reverse for parent→child
  // walk, then dedup keeps first occurrence (the earliest ancestor that listed
  // the attribute).
  const merge = (key: "variants" | "filters"): Types.ObjectId[] => {
    const seen = new Set<string>();
    const out: Types.ObjectId[] = [];
    for (const layer of [...chain].reverse()) {
      for (const id of layer[key]) {
        const idKey = String(id);
        if (!seen.has(idKey)) {
          seen.add(idKey);
          out.push(id);
        }
      }
    }
    return out;
  };

  const variantIds = merge("variants");
  const filterIds = merge("filters");

  // Self-heal dead refs via one $in fetch covering BOTH lists.
  const allIds = Array.from(
    new Set([...variantIds, ...filterIds].map((id) => String(id))),
  ).map((s) => new Types.ObjectId(s));

  const liveAttrs: any[] = allIds.length
    ? await AttributeModel.find({ _id: { $in: allIds } })
        .select("_id attribute_name display_type tracks_weight attribute_status")
        .lean()
    : [];
  const liveMap = new Map<string, any>(
    liveAttrs.map((a) => [String(a._id), a]),
  );

  const hydrate = (ids: Types.ObjectId[]): any[] =>
    ids
      .map((id) => liveMap.get(String(id)))
      .filter((a) => a && a.attribute_status !== "in-active");

  return {
    default_variant_attributes: hydrate(variantIds),
    default_filter_attributes: hydrate(filterIds),
  };
};

// Counts how many distinct attribute VALUES are actually used by products in
// a given set. Single aggregation: $unwind product_attributes → $unwind values
// → $group by value._id. Used by the storefront filter sidebar to hide
// 0-count values (industry-standard "hide empty" behavior).
//
// Caller passes productIds (already filtered by category, status, etc.).
export const countAttributeValueUsage = async (
  productIds: Types.ObjectId[],
): Promise<Record<string, number>> => {
  if (!productIds.length) return {};
  const rows = await ProductModel.aggregate([
    { $match: { _id: { $in: productIds } } },
    { $unwind: "$product_attributes" },
    { $unwind: "$product_attributes.values" },
    {
      $group: {
        _id: "$product_attributes.values._id",
        count: { $sum: 1 },
      },
    },
  ]);
  const map: Record<string, number> = {};
  for (const r of rows) {
    if (r?._id) map[String(r._id)] = r.count;
  }
  return map;
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
