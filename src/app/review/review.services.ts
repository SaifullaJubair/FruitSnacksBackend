import mongoose from "mongoose";
import ApiError from "../../errors/ApiError";
import OrderProductModel from "../orderProducts/orderProduct.model";
import { IReviewInterface, reviewSearchableField } from "./review.interface";
import ReviewModel from "./review.model";

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

// Find Review
export const findAllReviewServices = async (
  review_product_id: string,
  limit: number,
  skip: number,
): Promise<IReviewInterface[] | []> => {
  const findReview: IReviewInterface[] | [] = await ReviewModel.find({
    $and: [
      { review_status: "active" },
      { review_product_id: review_product_id },
    ],
  })
    .populate("review_user_id")
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

// Find all dashboard Review
export const findAllDashboardReviewServices = async (
  limit: number,
  skip: number,
  searchTerm: any
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
  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};
  const findReview: IReviewInterface[] | [] = await ReviewModel.find(
    whereCondition
  )
    .populate(["review_user_id", "review_product_id"])
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
