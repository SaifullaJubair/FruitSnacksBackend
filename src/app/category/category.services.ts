import mongoose, { Types } from "mongoose";
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
// M24 (2026-06-04): re-parent support. If the caller changes `parent_id`, we
// now ALSO recompute `category_path` + `depth` and CASCADE to every descendant
// category AND every product attached to this subtree (because products carry
// `category_path[]` snapshots — the storefront subtree filter reads that
// snapshot, so a re-parent without product cascade silently breaks filters).
// All writes happen in a mongoose transaction so a mid-cascade failure rolls
// back cleanly.
//
// Cycle prevention: rejects self-parent AND any case where the new parent is
// already a descendant of this node (would create A→B→A loops).
//
// Sibling-serial collision: when moved into a new sibling list, the moved
// node's `category_serial` may collide with an existing serial there. We
// auto-assign max(siblings) + 1 to keep the new sibling list orderable.
export const updateCategoryServices = async (
  data: ICategoryInterface,
  _id: string,
): Promise<ICategoryInterface | any> => {
  const existing: any = await CategoryModel.findOne({ _id });
  if (!existing) {
    return {};
  }

  const oldParent = existing.parent_id ? String(existing.parent_id) : null;
  // Distinguish "field absent" from "field set to null" — only treat as
  // re-parent intent when the caller explicitly sent parent_id.
  const newParentRaw =
    Object.prototype.hasOwnProperty.call(data || {}, "parent_id")
      ? (data as any).parent_id
      : undefined;
  const isReparent =
    newParentRaw !== undefined &&
    String(newParentRaw ?? "") !== String(oldParent ?? "");

  // Non-reparent path — preserve existing simple update behaviour exactly.
  // `parent_id` is dropped here: it's either absent, or present-but-unchanged
  // (isReparent already confirmed no real change). Forms always send it as a
  // string ("" for root), which Mongoose can't cast to ObjectId — passing it
  // through to updateOne() throws a CastError even though nothing moved.
  if (!isReparent) {
    const { parent_id, ...safeData } = data as any;
    const Category = await CategoryModel.updateOne({ _id }, safeData, {
      runValidators: true,
    });
    return Category;
  }

  // ── Re-parent path ──
  const newParentId = newParentRaw ? String(newParentRaw) : null;

  // Cycle guards.
  if (newParentId === String(_id)) {
    throw new ApiError(400, "Cannot make a category its own parent");
  }
  if (newParentId) {
    const isDescendant = await CategoryModel.exists({
      _id: newParentId,
      category_path: _id,
    });
    if (isDescendant) {
      throw new ApiError(
        400,
        "Cannot move category under one of its own descendants",
      );
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1. Resolve new position from new parent.
    const newPos = await resolveTreePosition(newParentId);

    // 2. Sibling-serial: when re-parenting, the admin form ALWAYS sends the
    //    node's existing serial (which may collide with the new sibling list).
    //    Auto-resolve in two cases:
    //      (a) caller omitted serial → use max+1
    //      (b) caller's serial collides with an existing sibling in the new
    //          parent → silently bump to max+1 instead of rejecting
    //    Item 8 audit follow-up: previously only (a) was handled, so a
    //    re-parent with the form's auto-included serial would hit the
    //    controller's pre-check and be rejected with a confusing "serial
    //    already added" error.
    let newSerial = (data as any).category_serial;
    const needsAutoSerial =
      newSerial === undefined || newSerial === null;
    let collides = false;
    if (!needsAutoSerial) {
      collides = !!(await CategoryModel.exists({
        parent_id: newPos.parent_id,
        category_serial: newSerial,
        _id: { $ne: _id },
      }).session(session));
    }
    if (needsAutoSerial || collides) {
      const maxSibling: any = await CategoryModel.findOne({
        parent_id: newPos.parent_id,
      })
        .sort({ category_serial: -1 })
        .select("category_serial")
        .session(session)
        .lean();
      newSerial = (maxSibling?.category_serial || 0) + 1;
    }

    // 3. Update this node.
    const thisIdObj = new Types.ObjectId(_id);
    await CategoryModel.updateOne(
      { _id },
      {
        ...data,
        parent_id: newPos.parent_id,
        depth: newPos.depth,
        category_path: newPos.category_path,
        category_serial: newSerial,
      },
      { session, runValidators: true },
    );

    // 4. Cascade to descendants. Each descendant's old path looked like:
    //    [...oldAncestorsAboveThis, thisId, ...descendantChainBelowThis]
    //    New path becomes:
    //    [...newPos.category_path, thisId, ...descendantChainBelowThis]
    const descendants: any[] = await CategoryModel.find({
      category_path: thisIdObj,
    })
      .session(session)
      .lean();

    // Build a quick lookup: descendantId → its NEW category_path (including
    // self at the end, the way products store it).
    const newPathByCategory = new Map<string, Types.ObjectId[]>();
    newPathByCategory.set(String(_id), [
      ...newPos.category_path,
      thisIdObj,
    ]);

    const descOps: any[] = [];
    for (const d of descendants) {
      const oldPath: Types.ObjectId[] = d.category_path || [];
      const idx = oldPath.findIndex((id) => String(id) === String(_id));
      // chainBelowThis = whatever sat between `_id` and the descendant in the
      // old path. For a direct child this is []; for grandchildren it's
      // [child_id]; etc.
      const chainBelowThis = idx >= 0 ? oldPath.slice(idx + 1) : [];
      const descNewCategoryPath = [
        ...newPos.category_path,
        thisIdObj,
        ...chainBelowThis,
      ];
      descOps.push({
        updateOne: {
          filter: { _id: d._id },
          update: {
            category_path: descNewCategoryPath,
            depth: descNewCategoryPath.length,
          },
        },
      });
      // For products attached to this descendant, the snapshot they store is
      // descNewCategoryPath + [descendantId] (the convention in product.model
      // is "ancestors then self" via category_path on product side).
      newPathByCategory.set(String(d._id), [...descNewCategoryPath, d._id]);
    }
    if (descOps.length) {
      await CategoryModel.bulkWrite(descOps, { session });
    }

    // 5. Cascade to products attached to this category OR any descendant.
    const affectedCategoryIds = [thisIdObj, ...descendants.map((d) => d._id)];
    const products: any[] = await ProductModel.find({
      category_id: { $in: affectedCategoryIds },
    })
      .select("_id category_id")
      .session(session)
      .lean();

    const prodOps: any[] = [];
    for (const p of products) {
      const target = newPathByCategory.get(String(p.category_id));
      if (target) {
        prodOps.push({
          updateOne: {
            filter: { _id: p._id },
            update: { category_path: target },
          },
        });
      }
    }
    if (prodOps.length) {
      await ProductModel.bulkWrite(prodOps, { session });
    }

    await session.commitTransaction();
    return { modifiedCount: 1, reparented: true };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

// M24 — count descendants + attached products for a re-parent confirmation
// dialog. Cheap pair of countDocuments queries — admin sees the blast radius
// before they confirm the move.
export const getReparentImpactServices = async (
  _id: string,
): Promise<{ descendant_count: number; product_count: number }> => {
  const thisIdObj = new Types.ObjectId(_id);
  const descendant_count = await CategoryModel.countDocuments({
    category_path: thisIdObj,
  });
  const product_count = await ProductModel.countDocuments({
    $or: [
      { category_id: thisIdObj },
      { category_path: thisIdObj },
    ],
  });
  return { descendant_count, product_count };
};

// Delete a Category
// Controller already enforces leaf-only + no-direct-products before calling
// this. After deletion we still $pull the deleted id from any product's
// category_path snapshot — covers the edge case where a product previously
// attached to a deeper descendant kept the deleted node as an ancestor in its
// snapshot (e.g. re-parent then delete).
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
  if (Category?.deletedCount > 0) {
    await ProductModel.updateMany(
      { category_path: new Types.ObjectId(_id) },
      { $pull: { category_path: new Types.ObjectId(_id) } },
    );
  }
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
