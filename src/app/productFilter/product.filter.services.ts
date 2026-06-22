/**
 * Product filter engine — Phase 4 rewrite (variation-attribute-filter feature).
 *
 * ONE source of truth = `attributes` + `product.product_attributes`. The
 * sidebar facets and the filter matching now read the SAME field, so they can
 * never desync (the old bug: sidebar came from `attributes`, matching ran on
 * `product.specifications` → never lined up).
 *
 * Category is the nested tree (Phase 0). "Products in category X" = the whole
 * SUBTREE, resolved via `product.category_path` (which holds the full root→leaf
 * ancestor chain inclusive), so `{ category_path: X }` matches X and every
 * descendant in one indexed query — no recursive lookups.
 *
 * Facets returned: Attribute (auto-discovered from the subtree's products) +
 * Brand + Price range + Availability. Matching is PRODUCT-LEVEL (StarTech-style,
 * PLAN): multiple values within one attribute = OR, across attributes = AND.
 */

import { Types } from "mongoose";
import AttributeModel from "../attribute/attribute.model";
import BrandModel from "../brand/brand.model";
import CategoryModel from "../category/category.model";
import { resolveCategoryDefaults } from "../category/category.services";
import {
  IProductInterface,
  productSearchableField,
} from "../product/product.interface";
import ProductModel from "../product/product.model";
import { getCachedSetting } from "../../helpers/settingCache";

// Resolve a category slug → the set of category ids that make up its subtree
// match. With product.category_path = full root→leaf chain, a single id is
// enough: `{ category_path: id }` matches the node and all descendants.
const resolveCategoryId = async (
  slug: any,
): Promise<Types.ObjectId | null> => {
  if (!slug || slug === "undefined") return null;
  const category = await CategoryModel.findOne({ category_slug: slug })
    .select("_id")
    .lean();
  return category ? (category._id as Types.ObjectId) : null;
};

// Build the product-scope match for a category subtree (+ active status).
const buildSubtreeMatch = (categoryId: Types.ObjectId | null) => {
  const match: any = { product_status: "active" };
  if (categoryId) {
    // category_path holds the full chain incl. self, so this matches the node
    // and every descendant. (Direct-leaf products also have self in the path.)
    match.category_path = categoryId;
  }
  return match;
};

// ── Drill-down: direct children of a category node (for the FE category nav) ──
// Replaces the old sub/child-category heading endpoint. Given a category slug,
// returns its immediate child categories (tree drill-down). sub/child args are
// ignored now (kept in the signature so the controller/route stay stable until
// the FE nav is rewritten in Phase 5).
export const findAllHeadingSub_Child_CategoryDataServices = async (
  categoryType: any,
  _sub_categoryType: any,
  _child_categoryType: any,
): Promise<any> => {
  const categoryId = await resolveCategoryId(categoryType);
  if (!categoryId) return [];
  return CategoryModel.find({
    parent_id: categoryId,
    category_status: "active",
  })
    .sort({ category_serial: 1 })
    .select("-__v")
    .lean();
};

// ── Sidebar facets for a category subtree ──
// Returns { maxPriceRange, brands, attributes } where `attributes` is
// auto-discovered: only the attributes (and only the values) that actually
// appear on active products in this subtree. `specifications` is kept as an
// alias of `attributes` for FE back-compat until Phase 5.
export const findAllActiveSideFilteredDataServices = async (
  categoryType: any,
  _subCategoryType: any,
  _childCategoryType: any,
): Promise<IProductInterface[] | any> => {
  const categoryId = await resolveCategoryId(categoryType);
  const productMatch = buildSubtreeMatch(categoryId);

  // 1) Discover which attribute_ids + value_ids exist on this subtree's products.
  //    Batch 2 E6 — skip product_attributes entries the owner has untoggled
  //    "Show in filter sidebar". `show_in_filter !== false` keeps legacy docs
  //    (without the field) included since the schema default is true.
  const discovered = await ProductModel.aggregate([
    { $match: productMatch },
    { $unwind: "$product_attributes" },
    { $match: { "product_attributes.show_in_filter": { $ne: false } } },
    {
      $group: {
        _id: "$product_attributes.attribute_id",
        value_ids: { $addToSet: "$product_attributes.value_ids" },
      },
    },
  ]);

  // Flatten the nested value_ids arrays into one distinct set per attribute.
  const valueIdsByAttribute = new Map<string, Set<string>>();
  discovered.forEach((row: any) => {
    if (!row?._id) return;
    const set = new Set<string>();
    (row.value_ids ?? []).forEach((arr: any[]) =>
      (arr ?? []).forEach((id: any) => id && set.add(String(id))),
    );
    valueIdsByAttribute.set(String(row._id), set);
  });

  // 2) Load those attributes and keep only the values that were discovered
  //    (and are active). This is the StarTech behaviour — show only facets that
  //    can actually match something in the current category.
  //
  //    Phase B M5 + M6 — UNION with category.default_filter_attributes (resolved
  //    with parent inheritance). Order: category defaults first (parent-first
  //    inside resolveCategoryDefaults), then product-driven extras. De-dup by
  //    attribute._id. Empty-value attributes from category defaults are still
  //    HIDDEN per locked rule "0-count values hidden" — we only include them if
  //    they survive the discovered-value filter below.
  let categoryDefaultIds: string[] = [];
  if (categoryId) {
    const resolved = await resolveCategoryDefaults(categoryId);
    categoryDefaultIds = resolved.default_filter_attributes.map((a: any) =>
      String(a._id),
    );
  }

  const orderedAttributeIdStrings: string[] = [];
  const seen = new Set<string>();
  for (const id of categoryDefaultIds) {
    if (!seen.has(id)) {
      seen.add(id);
      orderedAttributeIdStrings.push(id);
    }
  }
  for (const id of valueIdsByAttribute.keys()) {
    if (!seen.has(id)) {
      seen.add(id);
      orderedAttributeIdStrings.push(id);
    }
  }

  const attributeIds = orderedAttributeIdStrings.map(
    (id) => new Types.ObjectId(id),
  );
  const attributeDocs = attributeIds.length
    ? await AttributeModel.find({
        _id: { $in: attributeIds },
        attribute_status: "active",
      }).lean()
    : [];
  const attributeDocsById = new Map<string, any>(
    attributeDocs.map((a: any) => [String(a._id), a]),
  );

  const attributes = orderedAttributeIdStrings
    .map((id) => attributeDocsById.get(id))
    .filter(Boolean)
    .map((attr: any) => {
      const allowed = valueIdsByAttribute.get(String(attr._id)) ?? new Set();
      const values = (attr.attribute_values ?? []).filter(
        (v: any) =>
          v?.attribute_value_status === "active" &&
          allowed.has(String(v._id)),
      );
      return { ...attr, attribute_values: values };
    })
    .filter((attr: any) => attr.attribute_values.length > 0);

  // 3) Brands present on this subtree's products.
  const brandIds = await ProductModel.distinct("brand_id", productMatch);
  const brands = await BrandModel.find({
    _id: { $in: brandIds.filter(Boolean) },
    brand_status: "active",
  })
    .sort({ brand_serial: 1 })
    .lean();

  // 4) Max price for the price-range slider.
  // Fix #22 — variation products: max effective price = max(active variations'
  // variation_price). Simple products: product_price. Take overall max across
  // the whole subtree so the slider's right edge truly covers every product.
  const maxAgg = await ProductModel.aggregate([
    { $match: productMatch },
    {
      $lookup: {
        from: "variations",
        localField: "_id",
        foreignField: "product_id",
        as: "variations",
      },
    },
    {
      $addFields: {
        _activeVariations: {
          $filter: {
            input: "$variations",
            as: "v",
            cond: { $ne: ["$$v.is_active", false] },
          },
        },
      },
    },
    {
      $addFields: {
        _maxPrice: {
          $cond: {
            if: {
              $and: [
                { $eq: ["$is_variation", true] },
                { $gt: [{ $size: "$_activeVariations" }, 0] },
              ],
            },
            then: { $max: "$_activeVariations.variation_price" },
            else: "$product_price",
          },
        },
      },
    },
    {
      $group: { _id: null, max: { $max: "$_maxPrice" } },
    },
  ]);

  return {
    maxPriceRange: maxAgg?.[0]?.max ?? 0,
    brands,
    attributes,
    specifications: attributes, // FE back-compat alias (remove in Phase 5)
  };
};

// ── Filtered product listing (product-level match) ──
export const findAllActiveFilteredProductServices = async (
  conditions: any,
  filterData: any,
  limitNumber: number,
  skip: number,
): Promise<any> => {
  const parsedFilterData = filterData && JSON.parse(filterData);
  const minPrice = (parsedFilterData && parsedFilterData?.min_price) || 0;
  const maxPrice =
    (parsedFilterData && parsedFilterData?.max_price) ||
    Number.MAX_SAFE_INTEGER;
  const availability: any =
    (parsedFilterData && parsedFilterData?.availability) || [0, 1];
  // `filters` shape unchanged for FE: { [attributeId]: [valueId, ...] }.
  const filters: any = (parsedFilterData && parsedFilterData?.filters) || {};
  const brands: any = (parsedFilterData && parsedFilterData?.brands) || [];

  // Category subtree + active.
  const categoryId = await resolveCategoryId(conditions?.categoryType);
  const matchConditions: any = buildSubtreeMatch(categoryId);

  // trending_only=true → restrict to admin-flagged trending products.
  if (conditions?.trending_only === true) {
    matchConditions.trending_product = true;
  }

  // searchTerm → regex match across product fields + category name.
  if (conditions?.searchTerm) {
    const regex = { $regex: conditions.searchTerm, $options: "i" };
    // Find category ids whose name matches the search term
    const matchingCategories = await CategoryModel.find(
      { category_name: regex },
    ).select("_id").lean();
    const categoryIds = matchingCategories.map((c: any) => c._id);

    const fieldClauses = productSearchableField.map((field: string) => ({
      [field]: regex,
    }));
    if (categoryIds.length > 0) {
      fieldClauses.push({ category_path: { $in: categoryIds } } as any);
    }
    matchConditions.$or = fieldClauses;
  }

  // C13 HIGH 4 — hide_out_of_stock_products server-side enforcement.
  // Client query param `availability` is a UX hint only; this toggle overrides
  // it unconditionally so DevTools manipulation cannot bypass it.
  // We inject into matchConditions (pre-pipeline) so the DB scan itself excludes
  // OOS products — it is NOT the same as the post-pipeline availability filter
  // which evaluates effective_stock computed from variation aggregation.
  // For variation products we cannot compute effective_stock in a simple $match,
  // so we piggy-back on product_quantity (set to 0 by zero-stock-when-variation
  // migration script) AND the client availability param override below.
  const filterSetting = await getCachedSetting().catch(() => null);
  if (filterSetting?.hide_out_of_stock_products) {
    // Force availability to in-stock only — overrides whatever client sent.
    // The post-pipeline $match on effective_stock handles variation products.
    (availability as any[]).length = 0;
    (availability as any[]).push(1); // 1 = in-stock only
  }

  // Attribute match (product-level): within one attribute = OR over its values,
  // across attributes = AND. Matches against product_attributes (same field the
  // facets came from → sidebar and match never desync).
  const attributeAndClauses = Object.entries(filters)
    .filter(([, values]: any) => Array.isArray(values) && values.length)
    .map(([attributeId, values]: any) => ({
      product_attributes: {
        $elemMatch: {
          attribute_id: new Types.ObjectId(attributeId),
          value_ids: {
            $in: values.map((v: any) => new Types.ObjectId(v)),
          },
        },
      },
    }));
  if (attributeAndClauses.length) {
    matchConditions.$and = attributeAndClauses;
  }

  const pipeline: any[] = [
    { $match: matchConditions },
    // Brand lookup (+ optional brand-slug filter).
    {
      $lookup: {
        from: "brands",
        localField: "brand_id",
        foreignField: "_id",
        as: "brand",
      },
    },
    { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },
    ...(brands.length
      ? [{ $match: { "brand.brand_slug": { $in: brands } } }]
      : []),
    {
      $lookup: {
        from: "variations",
        localField: "_id",
        foreignField: "product_id",
        as: "variations",
      },
    },
    {
      $addFields: {
        variations: {
          $map: {
            input: "$variations",
            as: "variation",
            in: {
              _id: "$$variation._id",
              variation_name: "$$variation.variation_name",
              product_id: "$$variation.product_id",
              variation_price: "$$variation.variation_price",
              variation_discount_price: "$$variation.variation_discount_price",
              variation_price_delta: "$$variation.variation_price_delta",
              variation_quantity: "$$variation.variation_quantity",
              variation_image: "$$variation.variation_image",
              variation_images: "$$variation.variation_images",
              is_active: "$$variation.is_active",
            },
          },
        },
      },
    },
    // Card hover-carousel images: flatten every variation's variation_images
    // (the multi-image array), append other_images, drop the main_image (it's
    // the card's base layer) + empties, de-dupe, cap. The storefront ProductCard
    // reads `card_hover_images` directly so the list payload stays lean (we
    // don't ship full variation/other_image objects to the grid).
    {
      $addFields: {
        card_hover_images: {
          $let: {
            vars: {
              merged: {
                $concatArrays: [
                  {
                    $reduce: {
                      input: { $ifNull: ["$variations", []] },
                      initialValue: [],
                      in: {
                        $concatArrays: [
                          "$$value",
                          { $ifNull: ["$$this.variation_images", []] },
                        ],
                      },
                    },
                  },
                  {
                    $map: {
                      input: { $ifNull: ["$other_images", []] },
                      as: "o",
                      in: "$$o.other_image",
                    },
                  },
                ],
              },
            },
            in: {
              $slice: [
                {
                  $reduce: {
                    input: "$$merged",
                    initialValue: [],
                    in: {
                      $cond: [
                        {
                          $and: [
                            { $ne: ["$$this", null] },
                            { $ne: ["$$this", ""] },
                            { $ne: ["$$this", "$main_image"] },
                            { $not: [{ $in: ["$$this", "$$value"] }] },
                          ],
                        },
                        { $concatArrays: ["$$value", ["$$this"]] },
                        "$$value",
                      ],
                    },
                  },
                },
                6,
              ],
            },
          },
        },
      },
    },
    // Fix #22 — compute effective price + stock that mirrors what the
    // storefront card actually shows the customer:
    //   - variation product → cheapest active variation's price (StarTech-
    //     style "from ₹X"); stock = SUM of active variation stocks
    //   - simple product   → product_price / product_quantity unchanged
    // This is what user-facing price filter and OOS filter should evaluate
    // against. Without this, filter checks `product_price` (base) while card
    // shows `variation_price` (base+delta) → mismatch (e.g. base 600 passes a
    // 1-608 filter even though final price is 640).
    {
      $addFields: {
        _activeVariations: {
          $filter: {
            input: "$variations",
            as: "v",
            cond: { $ne: ["$$v.is_active", false] },
          },
        },
      },
    },
    {
      $addFields: {
        effective_price: {
          $cond: {
            if: { $eq: ["$is_variation", true] },
            then: {
              $cond: {
                if: { $gt: [{ $size: "$_activeVariations" }, 0] },
                then: { $min: "$_activeVariations.variation_price" },
                else: "$product_price",
              },
            },
            else: "$product_price",
          },
        },
        effective_stock: {
          $cond: {
            if: { $eq: ["$is_variation", true] },
            then: {
              $cond: {
                if: { $gt: [{ $size: "$_activeVariations" }, 0] },
                then: { $sum: "$_activeVariations.variation_quantity" },
                else: 0,
              },
            },
            else: { $ifNull: ["$product_quantity", 0] },
          },
        },
      },
    },
    {
      $lookup: {
        from: "reviews",
        localField: "_id",
        foreignField: "review_product_id",
        as: "reviews",
      },
    },
    {
      $addFields: {
        average_review_rating: {
          $cond: {
            if: { $gt: [{ $size: "$reviews" }, 0] },
            then: {
              $divide: [
                { $sum: "$reviews.review_ratting" },
                { $size: "$reviews" },
              ],
            },
            else: 0,
          },
        },
        total_reviews: { $size: "$reviews" },
      },
    },
    // Price range + availability (brand active already ensured by status? brand
    // is optional, so keep the active-or-null guard).
    // Fix #22 — filter on effective_price + effective_stock (variation-aware).
    {
      $match: {
        $and: [
          { $or: [{ "brand.brand_status": "active" }, { brand: null }] },
          {
            effective_price: { $gte: minPrice, $lte: maxPrice },
          },
          ...(availability.length
            ? [
                {
                  $or: [
                    ...(availability.includes(0)
                      ? [{ effective_stock: { $lte: 0 } }]
                      : []),
                    ...(availability.includes(1)
                      ? [{ effective_stock: { $gt: 0 } }]
                      : []),
                  ],
                },
              ]
            : []),
        ],
      },
    },
    {
      $project: {
        _id: 1,
        product_name: 1,
        product_slug: 1,
        main_image: 1,
        // Storefront card media: main_video drives the hover-video; if there's
        // no video, card_hover_images drives the hover carousel. Both must
        // survive the inclusion-projection or the card has nothing to show.
        main_video: 1,
        card_hover_images: 1,
        attributes_details: {
          $let: {
            vars: {
              filteredAttributes: {
                $filter: {
                  input: "$attributes_details",
                  as: "attribute",
                  cond: {
                    $gt: [
                      {
                        $size: {
                          $filter: {
                            input: "$$attribute.attribute_values",
                            as: "value",
                            cond: {
                              $and: [
                                { $ne: ["$$value.attribute_value_code", null] },
                                {
                                  $ne: [
                                    "$$value.attribute_value_code",
                                    "undefined",
                                  ],
                                },
                                { $ne: ["$$value.attribute_value_code", ""] },
                              ],
                            },
                          },
                        },
                      },
                      0,
                    ],
                  },
                },
              },
            },
            in: {
              $cond: {
                if: { $eq: [{ $size: "$$filteredAttributes" }, 0] },
                then: "$$REMOVE",
                else: {
                  $cond: {
                    if: { $eq: [{ $size: "$$filteredAttributes" }, 1] },
                    then: { $arrayElemAt: ["$$filteredAttributes", 0] },
                    else: "$$filteredAttributes",
                  },
                },
              },
            },
          },
        },
        product_price: 1,
        product_discount_price: 1,
        createdAt: 1,
        updatedAt: 1,
        brand: { _id: 1, brand_name: 1, brand_slug: 1 },
        is_variation: 1,
        variations: {
          $cond: {
            if: { $eq: ["$is_variation", true] },
            then: { $arrayElemAt: ["$variations", 0] },
            else: {},
          },
        },
        average_review_rating: 1,
        total_reviews: 1,
        // F3.3 — these must survive the $project so the downstream $sort can
        // order by them. effective_price is computed earlier (variation-aware
        // "from" price); sold_count is a root field (default 0). Without
        // re-including them here the inclusion-projection drops them → $sort
        // sees null and price/popular ordering silently no-ops.
        effective_price: 1,
        sold_count: 1,
      },
    },
  ];

  // F3.3 — catalog-wide sort. The pipeline above produces effective_price /
  // average_review_rating / createdAt / sold_count for every matched row, so we
  // can sort the WHOLE result set here (server-side) instead of the FE only
  // re-ordering the current page's ~20 rows ("popular ≠ popular" bug).
  //   - "trending" is NOT a sort: it's a trending_product flag filter applied
  //     pre-pipeline (matchConditions), so it never reaches this map.
  //   - Unknown / missing sort → latest (createdAt desc) = the old natural-ish
  //     default the FE used.
  // Tie-breakers (createdAt) keep pagination deterministic across pages.
  const SORT_MAP: Record<string, Record<string, 1 | -1>> = {
    latest: { createdAt: -1 },
    price_asc: { effective_price: 1, createdAt: -1 },
    price_desc: { effective_price: -1, createdAt: -1 },
    popular: { sold_count: -1, createdAt: -1 },
    rating: { average_review_rating: -1, createdAt: -1 },
  };
  const sortStage = SORT_MAP[conditions?.sort as string] || SORT_MAP.latest;

  // $sort lives ONLY in the paginated arm — adding it to the count arm would
  // force Mongo to materialise + sort the whole match set just to $count it
  // (B2). Count is order-independent, so it stays sort-free.
  const findFilterProduct: any = await ProductModel.aggregate([
    ...pipeline,
    { $sort: sortStage },
    { $skip: skip },
    { $limit: limitNumber },
  ]);

  const totalCount = await ProductModel.aggregate([
    ...pipeline,
    { $count: "total" },
  ]);

  return {
    totalData: totalCount[0]?.total || 0,
    filteredData: findFilterProduct,
  };
};

// ── Search ──
export const findAllSearchTermProductServices = async (
  limit: any,
  skip: any,
  searchTerm: any,
): Promise<any> => {
  const andCondition: any[] = [];
  if (searchTerm) {
    const regex = { $regex: searchTerm, $options: "i" };
    const matchingCategories = await CategoryModel.find(
      { category_name: regex },
    ).select("_id").lean();
    const categoryIds = matchingCategories.map((c: any) => c._id);

    const fieldClauses: any[] = productSearchableField.map((field) => ({
      [field]: regex,
    }));
    if (categoryIds.length > 0) {
      fieldClauses.push({ category_path: { $in: categoryIds } });
    }
    andCondition.push({ $or: fieldClauses });
  }
  andCondition.push({ product_status: "active" });
  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};

  const basePipeline: any[] = [
    { $match: whereCondition },
    {
      $lookup: {
        from: "categories",
        localField: "category_id",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "brands",
        localField: "brand_id",
        foreignField: "_id",
        as: "brand",
      },
    },
    { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },
    {
      $match: {
        $or: [
          { "category.category_status": "active" },
          { category: null },
          { category: { $exists: false } },
        ],
        $and: [
          { $or: [{ "brand.brand_status": "active" }, { brand: null }] },
        ],
      },
    },
  ];

  const totalData = await ProductModel.aggregate([
    ...basePipeline,
    { $count: "total" },
  ]);
  const totalCount = totalData.length > 0 ? totalData[0].total : 0;

  const findAllSearchProductProduct = await ProductModel.aggregate([
    ...basePipeline,
    {
      $lookup: {
        from: "variations",
        localField: "_id",
        foreignField: "product_id",
        as: "variations",
      },
    },
    {
      $addFields: {
        variations: {
          $map: {
            input: "$variations",
            as: "variation",
            in: {
              _id: "$$variation._id",
              variation_name: "$$variation.variation_name",
              product_id: "$$variation.product_id",
              variation_price: "$$variation.variation_price",
              variation_discount_price: "$$variation.variation_discount_price",
              variation_price_delta: "$$variation.variation_price_delta",
              variation_quantity: "$$variation.variation_quantity",
              variation_image: "$$variation.variation_image",
            },
          },
        },
      },
    },
    {
      $lookup: {
        from: "reviews",
        localField: "_id",
        foreignField: "review_product_id",
        as: "reviews",
      },
    },
    {
      $addFields: {
        average_review_rating: {
          $cond: {
            if: { $gt: [{ $size: "$reviews" }, 0] },
            then: {
              $divide: [
                { $sum: "$reviews.review_ratting" },
                { $size: "$reviews" },
              ],
            },
            else: 0,
          },
        },
        total_reviews: { $size: "$reviews" },
      },
    },
    {
      $project: {
        _id: 1,
        product_name: 1,
        product_slug: 1,
        main_image: 1,
        product_price: 1,
        product_discount_price: 1,
        createdAt: 1,
        updatedAt: 1,
        brand: { _id: 1, brand_name: 1 },
        product_category: { _id: "$category._id", category_name: "$category.category_name" },
        is_variation: 1,
        variations: {
          $cond: {
            if: { $eq: ["$is_variation", true] },
            then: { $arrayElemAt: ["$variations", 0] },
            else: {},
          },
        },
        average_review_rating: 1,
        total_reviews: 1,
      },
    },
    { $skip: skip },
    { $limit: limit },
  ]);

  return {
    data: findAllSearchProductProduct,
    totalData: totalCount,
  };
};
