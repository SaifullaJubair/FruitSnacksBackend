import mongoose from "mongoose";
import ApiError from "../../errors/ApiError";
import OrderProductModel from "../orderProducts/orderProduct.model";
import ProductModel from "../product/product.model";
import { IReviewInterface, reviewSearchableField } from "./review.interface";
import ReviewModel from "./review.model";
import {
  USER_PUBLIC_PROJECTION,
  USER_REVIEWER_PUBLIC_PROJECTION,
} from "../user/user.interface";

// Find A Review with serial
export const findAReviewSerialServices = async (
  review_user_id: string,
  review_product_id: string
): Promise<IReviewInterface | null> => {
  const findReview: IReviewInterface | null = await ReviewModel.findOne({
    review_user_id: review_user_id,
    review_product_id: review_product_id,
  });
  return findReview;
};

// Create A Review
export const postReviewServices = async (
  data: IReviewInterface
): Promise<IReviewInterface | {}> => {
  const createReview: IReviewInterface | {} = await ReviewModel.create(data);
  return createReview;
};

// Find Review — respects enable_seeded_reviews toggle from settings
export const findAllReviewServices = async (
  review_product_id: string,
  limit: number,
  skip: number,
  showSeeded = true,
): Promise<IReviewInterface[] | []> => {
  const filter: any = {
    review_status: "active",
    review_product_id: review_product_id,
  };
  if (!showSeeded) {
    filter.is_seeded = { $ne: true };
  }
  const findReview: IReviewInterface[] | [] = await ReviewModel.find(filter)
    // SECURITY: PUBLIC per-product review list (no auth). Projecting the
    // reviewer on the populate stops the user_password hash leaking to any
    // visitor (.select() on the parent doesn't reach populated docs). Ported
    // from core 2026-07-17.
    .populate({ path: "review_user_id", select: USER_REVIEWER_PUBLIC_PROJECTION })
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .select("-__v");
  return findReview;
};

// Find aUser Review
export const findUserReviewServices = async (
  limit: number,
  skip: number,
  searchTerm: any,
  review_user_id: any
): Promise<IReviewInterface[] | []> => {
  const andCondition = [];
  if (searchTerm) {
    andCondition.push({
      $or: reviewSearchableField.map((field) => ({
        [field]: {
          $regex: searchTerm,
          $options: "i",
        },
      })),
    });
  }
  andCondition.push({ review_user_id: review_user_id });
  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};
  const findReview: IReviewInterface[] | [] = await ReviewModel.find(
    whereCondition
  )
    .populate([
      {
        path: "review_product_id",
        model: "products",
        populate: [
          {
            path: "category_id",
            model: "categories",
            select: ["category_name", "category_slug"],
          },
          {
            path: "brand_id",
            model: "brands",
            select: ["brand_name", "brand_slug"],
          },
        ],
        select: ["product_name", "product_slug", "main_image"],
      },
    ])
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .select("-__v");
  return findReview;
};

// F4.1 — public featured reviews for the home ReviewsCarousel (auto_featured
// mode). Active + top-rated + has a photo. No auth, no review_user_id needed
// (the old carousel call hit findUserReview which 400s without it → section
// never rendered). Populates the product name/slug for the card subtitle.
export const findFeaturedReviewsServices = async (
  limit: number,
  minRating = 5,
): Promise<IReviewInterface[] | []> => {
  return ReviewModel.find({
    review_status: "active",
    review_ratting: { $gte: minRating },
    review_image: { $exists: true, $nin: [null, ""] },
  })
    .populate([
      {
        path: "review_product_id",
        model: "products",
        select: ["product_name", "product_slug", "main_image"],
      },
    ])
    .sort({ _id: -1 })
    .limit(limit)
    .select("-__v -review_user_id")
    .lean();
};

// Find all dashboard Review
// C13 HIGH 7 — optional `status` param for Pending Reviews moderation queue.
// Pass status="pending" to get only pending reviews; omit for all reviews.
export const findAllDashboardReviewServices = async (
  limit: number,
  skip: number,
  searchTerm: any,
  status?: string
): Promise<IReviewInterface[] | []> => {
  const andCondition: any[] = [];
  if (status) {
    andCondition.push({ review_status: status });
  }
  if (searchTerm) {
    andCondition.push({
      $or: reviewSearchableField.map((field) => ({
        [field]: {
          $regex: searchTerm,
          $options: "i",
        },
      })),
    });
  }
  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};
  const findReview: IReviewInterface[] | [] = await ReviewModel.find(
    whereCondition
  )
    // SECURITY: project the reviewer — an unprojected populate leaked the
    // user_password hash into the admin review list. Ported from core 2026-07-17.
    .populate([
      { path: "review_user_id", select: USER_PUBLIC_PROJECTION },
      { path: "review_product_id" },
    ])
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .select("-__v");
  return findReview;
};

// Update a Review
export const updateReviewServices = async (
  requestData: any,
  _id: string
): Promise<IReviewInterface | any> => {
  const updateReviewInfo: IReviewInterface | null = await ReviewModel.findOne({
    _id: _id,
  });
  if (!updateReviewInfo) {
    throw new ApiError(400, "Review Not Found !");
  }
  const Review = await ReviewModel.updateOne({ _id: _id }, requestData, {
    runValidators: true,
  });
  return Review;
};

// Delete a Review
export const deleteReviewServices = async (
  _id: string
): Promise<IReviewInterface | any> => {
  const Review = await ReviewModel.deleteOne(
    { _id: _id },
    {
      runValidators: true,
    }
  );
  return Review;
};

// find all unreviewed products
export const findUnReviewedProductServices = async (
  customer_id: any
): Promise<any> => {
  const unreviewedProducts: any = await OrderProductModel.aggregate([
    // Match orders by the customer_id
    { $match: { customer_id: new mongoose.Types.ObjectId(customer_id) } },

    // Lookup to ReviewModel to find matching reviews
    {
      $lookup: {
        from: "reviews", // The collection name for ReviewModel
        let: { productId: "$product_id", customerId: "$customer_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$review_product_id", "$$productId"] },
                  { $eq: ["$review_user_id", "$$customerId"] },
                ],
              },
            },
          },
        ],
        as: "reviews",
      },
    },

    // Filter out products that already have a review
    { $match: { reviews: { $size: 0 } } },

    // Lookup to Products model to get product details
    {
      $lookup: {
        from: "products", // The collection name for ProductModel
        localField: "product_id",
        foreignField: "_id",
        pipeline: [
          {
            $lookup: {
              from: "categories", // The collection name for CategoryModel
              localField: "category_id", // Use the category_id from products
              foreignField: "_id", // Match it with the categories' _id
              pipeline: [
                {
                  $project: {
                    category_name: 1,
                    category_slug: 1,
                  },
                },
              ],
              as: "category_info",
            },
          },
          {
            $lookup: {
              from: "brands", // The collection name for BrandModel
              localField: "brand_id", // Use the brand_id from products
              foreignField: "_id", // Match it with the brands' _id
              pipeline: [
                {
                  $project: {
                    brand_name: 1,
                    brand_slug: 1,
                  },
                },
              ],
              as: "brand_info",
            },
          },
          {
            $project: {
              product_name: 1,
              product_slug: 1,
              main_image: 1,
              category_info: { $arrayElemAt: ["$category_info", 0] }, // Flatten the category_info array
              brand_info: { $arrayElemAt: ["$brand_info", 0] }, // Flatten the brand_info array
            },
          },
        ],
        as: "product_info",
      },
    },

    // Unwind the product_info array
    { $unwind: "$product_info" },

    // Group by the product_info._id to remove duplicates
    {
      $group: {
        _id: "$product_info._id",
        product_name: { $first: "$product_info.product_name" },
        product_slug: { $first: "$product_info.product_slug" },
        main_image: { $first: "$product_info.main_image" },
        category_name: { $first: "$product_info.category_info.category_name" },
        category_slug: { $first: "$product_info.category_info.category_slug" },
        brand_name: { $first: "$product_info.brand_info.brand_name" },
        brand_slug: { $first: "$product_info.brand_info.brand_slug" },
      },
    },

    // Sort the results
    { $sort: { _id: -1 } },
  ]);

  return unreviewedProducts;
};

// ─── Seed Review — Bulk Upload ────────────────────────────────────────────────
// rows: array of review objects from CSV/JSON parse.
// dry_run: if true, validate + count but don't write to DB.
// Returns { inserted, skipped, failed } counts + per-row failure reasons.
export const seedReviewBulkServices = async (
  rows: any[],
  dry_run = false,
  shared_image?: string,
): Promise<{ inserted: number; skipped: number; failed: { row: number; reason: string }[] }> => {
  if (!rows || rows.length === 0) {
    return { inserted: 0, skipped: 0, failed: [] };
  }
  if (rows.length > 500) {
    throw new ApiError(400, "Bulk seed limit is 500 rows per upload.");
  }

  let inserted = 0;
  let skipped = 0;
  const failed: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    try {
      const { review_product_id, review_ratting, review_description, reviewer_name, reviewer_verified, review_image } = row;

      if (!review_product_id) { failed.push({ row: rowNum, reason: "review_product_id required" }); continue; }
      if (!review_description || String(review_description).trim() === "") { failed.push({ row: rowNum, reason: "review_description required" }); continue; }
      const rating = Number(review_ratting);
      if (isNaN(rating) || rating < 1 || rating > 5) { failed.push({ row: rowNum, reason: "review_ratting must be 1–5" }); continue; }

      // Reject bad/non-existent product ids up front so we never create orphan
      // reviews (valid-format-but-missing ObjectIds would otherwise insert).
      if (!mongoose.Types.ObjectId.isValid(review_product_id)) {
        failed.push({ row: rowNum, reason: "review_product_id is not a valid id" }); continue;
      }
      const productExists = await ProductModel.exists({ _id: review_product_id });
      if (!productExists) { failed.push({ row: rowNum, reason: "product not found" }); continue; }

      // Row's own image wins; only empty/missing rows fall back to shared_image.
      const rowImage =
        review_image && String(review_image).trim() !== ""
          ? String(review_image).trim()
          : shared_image || undefined;

      // Dedup check: same product + reviewer_name + description = duplicate
      const existing = await ReviewModel.findOne({
        review_product_id,
        reviewer_name: String(reviewer_name || "").trim(),
        review_description: String(review_description).trim(),
        is_seeded: true,
      }).lean();
      if (existing) { skipped++; continue; }

      if (!dry_run) {
        await ReviewModel.create({
          review_product_id,
          review_ratting: rating,
          review_description: String(review_description).trim(),
          review_status: "active",
          is_seeded: true,
          source: "csv_bulk",
          reviewer_name: String(reviewer_name || "").trim(),
          reviewer_verified: Boolean(reviewer_verified),
          review_image: rowImage,
        });
      }
      inserted++;
    } catch (err: any) {
      failed.push({ row: rowNum, reason: err?.message || "Unknown error" });
    }
  }

  return { inserted, skipped, failed };
};

// ─── Seed Review — Manual Admin Add (one or many products) ───────────────────
// Same review text/rating/image is copied to every selected product. Dedup ON:
// a product that already has this exact seed (product + name + description) is
// skipped, not duplicated. Returns per-product insert/skip counts.
export const seedReviewManualServices = async (
  data: any,
): Promise<{ inserted: number; skipped: number; skippedProducts: string[] }> => {
  const { review_product_ids, review_ratting, review_description, reviewer_name, reviewer_verified, review_image, review_status } = data;

  const ids: string[] = Array.isArray(review_product_ids) ? review_product_ids : [];
  if (ids.length === 0) throw new ApiError(400, "At least one product is required");
  if (!review_description || String(review_description).trim() === "") throw new ApiError(400, "review_description required");
  const rating = Number(review_ratting);
  if (isNaN(rating) || rating < 1 || rating > 5) throw new ApiError(400, "review_ratting must be 1–5");

  const name = String(reviewer_name || "").trim();
  const description = String(review_description).trim();
  const status = review_status || "active";

  let inserted = 0;
  let skipped = 0;
  const skippedProducts: string[] = [];

  for (const pid of ids) {
    if (!mongoose.Types.ObjectId.isValid(pid)) {
      skipped++; skippedProducts.push(pid); continue;
    }
    const productExists = await ProductModel.exists({ _id: pid });
    if (!productExists) { skipped++; skippedProducts.push(pid); continue; }

    // Dedup: same product + reviewer_name + description already seeded → skip.
    const existing = await ReviewModel.findOne({
      review_product_id: pid,
      reviewer_name: name,
      review_description: description,
      is_seeded: true,
    }).lean();
    if (existing) { skipped++; skippedProducts.push(pid); continue; }

    await ReviewModel.create({
      review_product_id: pid,
      review_ratting: rating,
      review_description: description,
      review_status: status,
      is_seeded: true,
      source: "manual_admin",
      reviewer_name: name,
      reviewer_verified: Boolean(reviewer_verified),
      review_image: review_image || undefined,
    });
    inserted++;
  }

  return { inserted, skipped, skippedProducts };
};

// ─── Seed Review — List (admin view of seeded reviews) ───────────────────────
export const findAllSeededReviewServices = async (
  limit: number,
  skip: number,
  searchTerm?: string,
  product_id?: string,
): Promise<{ reviews: IReviewInterface[]; totalCount: number }> => {
  const filter: any = { is_seeded: true };
  if (product_id) filter.review_product_id = product_id;
  if (searchTerm) {
    filter.$or = [
      { reviewer_name: { $regex: searchTerm, $options: "i" } },
      { review_description: { $regex: searchTerm, $options: "i" } },
    ];
  }

  const [reviews, totalCount] = await Promise.all([
    ReviewModel.find(filter)
      .populate("review_product_id", "product_name product_slug main_image")
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit)
      .select("-__v"),
    ReviewModel.countDocuments(filter),
  ]);
  return { reviews, totalCount };
};

// Track D — Reviews carousel manual-pick: fetch specific reviews by IDs.
// Filters deleted/inactive reviews so stale IDs in settings don't crash FE.
export const findReviewsByIdsServices = async (
  ids: string[],
): Promise<IReviewInterface[]> => {
  if (!ids || ids.length === 0) return [];
  const objectIds = ids
    .map((id) => {
      try { return new mongoose.Types.ObjectId(id); }
      catch { return null; }
    })
    .filter(Boolean);

  return ReviewModel.find({
    _id: { $in: objectIds },
    review_status: "active",
  })
    .populate("review_user_id", "user_name")
    .sort({ _id: -1 })
    .select("-__v")
    .lean();
};

// // Project the desired fields (Inclusion-based approach)
// {
//   $project: {
//     _id: 1,
//     invoice_id: 1,
//     order_id: 1,
//     product_id: 1,
//     variation_id: 1,
//     product_main_price: 1,
//     product_main_discount_price: 1,
//     product_unit_price: 1,
//     product_quantity: 1,
//     product_unit_final_price: 1,
//     product_grand_total_price: 1,
//     campaign_id: 1,
//     customer_id: 1,
//     createdAt: 1,
//     updatedAt: 1,
//     product_info: 1, // Include product_name and product_main_image
//   },
// },
