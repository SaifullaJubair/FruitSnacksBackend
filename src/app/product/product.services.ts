import mongoose, { Types } from "mongoose";
import ApiError from "../../errors/ApiError";
import VariationModel from "../variation/variation.model";
import { IProductInterface, productSearchableField } from "./product.interface";
import ProductModel from "./product.model";
import OrderProductModel from "../orderProducts/orderProduct.model";
import ReviewModel from "../review/review.model";
import CategoryModel from "../category/category.model";
import BrandModel from "../brand/brand.model";

// Create A Product
export const postProductServices = async (
  data: IProductInterface,
  session: mongoose.ClientSession,
): Promise<IProductInterface | {} | any> => {
  const createProduct: IProductInterface | {} | any = await ProductModel.create(
    [data],
    { session },
  );
  return createProduct[0];
};

// Find a Product Details
export const findAProductDetailsServices = async (
  product_slug: string,
): Promise<any | null> => {
  // ✅ Helper function — product fetch করার জন্য
  const fetchProduct = async (slug: string, isHistorySlug = false) => {
    return await ProductModel.findOne({
      ...(isHistorySlug
        ? { product_slug_history: { $in: [slug] } }
        : { product_slug: slug }),
      product_status: "active",
    })
      .populate([
        { path: "category_id", model: "categories" },
        { path: "sub_category_id", model: "subcategories" },
        { path: "brand_id", model: "brands" },
        {
          path: "specifications.specification_id",
          model: "specifications", // ✅ fix — আগে "attributes" ছিল
        },
        { path: "theme_id", model: "themes" },
      ])
      .select(
        "-__v -barcode -barcode_image -product_publisher_id -product_by -product_supplier_id -product_buying_price -product_alert_quantity -createdAt -updatedAt",
      )
      .lean();
  };

  // Step 1: Current slug এ খোঁজো
  let findProduct: any = await fetchProduct(product_slug);
  let redirect_slug: string | null = null;

  // Step 2: না পেলে slug history তে খোঁজো
  if (!findProduct) {
    const historyProduct: any = await fetchProduct(product_slug, true);

    if (historyProduct) {
      // পুরনো slug — নতুন slug এ redirect করতে হবে
      redirect_slug = historyProduct.product_slug;
      return { redirect_slug };
    }

    throw new ApiError(404, "Product Not Found !");
  }

  // Step 3: Category, brand status check
  if (findProduct?.category_id?.category_status !== "active") {
    throw new ApiError(404, "Product Unavailable !");
  }
  if (
    findProduct?.sub_category_id &&
    findProduct?.sub_category_id?.sub_category_status !== "active"
  ) {
    throw new ApiError(404, "Product Unavailable !");
  }
  if (
    findProduct?.brand_id &&
    findProduct?.brand_id?.brand_status !== "active"
  ) {
    throw new ApiError(404, "Product Unavailable !");
  }

  const targetProductId = findProduct?._id;

  // Step 3: Extract specific campaign product details
  // const campaignId = findProduct?.product_campaign_id;

  // if (campaignId && "campaign_products" in campaignId) {
  //   if (campaignId?.campaign_status === "active") {
  //     const campaignProduct = campaignId?.campaign_products?.find(
  //       (product: any) =>
  //         product?.campaign_product_id?.equals(targetProductId) &&
  //         product?.campaign_product_status === "active"
  //     );

  //     if (campaignProduct) {
  //       findProduct.campaign_details = {
  //         _id: campaignId?._id,
  //         campaign_start_date: campaignId?.campaign_start_date,
  //         campaign_end_date: campaignId?.campaign_end_date,
  //         campaign_status: campaignId?.campaign_status,
  //         campaign_title: campaignId?.campaign_title,
  //         campaign_product: campaignProduct,
  //       };
  //       delete findProduct?.product_campaign_id;
  //     } else {
  //       delete findProduct?.product_campaign_id;
  //     }
  //   } else {
  //     delete findProduct?.product_campaign_id;
  //   }
  // }

  // Step 3: Check if the product has variations
  if (findProduct?.is_variation) {
    const variations = await VariationModel.find({
      product_id: targetProductId,
    })
      .select(
        "-__v -variation_buying_price -variation_alert_quantity -variation_barcode -variation_barcode_image -variation_image_key -variation_sku -createdAt -updatedAt",
      )
      .lean();

    findProduct.variations = variations;
  }

  // Step 5: other_images key সরাও
  if (findProduct?.other_images) {
    findProduct.other_images = findProduct?.other_images.map((image: any) => ({
      other_image: image.other_image,
      _id: image._id,
    }));
  }

  // Step 6: Category, subcategory, brand cleanup
  if (findProduct?.category_id) {
    findProduct.category_id = {
      _id: findProduct?.category_id?._id,
      category_name: findProduct?.category_id?.category_name,
      category_slug: findProduct?.category_id?.category_slug,
    };
  }

  // Transform sub_category_id and child_category_id similarly if needed
  if (findProduct?.sub_category_id) {
    findProduct.sub_category_id = {
      _id: findProduct?.sub_category_id?._id,
      sub_category_name: findProduct?.sub_category_id?.sub_category_name,
    };
  }

  // if (findProduct?.child_category_id) {
  //   findProduct.child_category_id = {
  //     _id: findProduct?.child_category_id?._id,
  //     child_category_name: findProduct?.child_category_id?.child_category_name,
  //   };
  // }
  if (findProduct?.brand_id) {
    findProduct.brand_id = {
      _id: findProduct?.brand_id?._id,
      brand_name: findProduct?.brand_id?.brand_name,
    };
  }

  // Step 7: Specifications filter
  // ✅ Fix — আগে attribute_values ও attribute_name ব্যবহার হচ্ছিল
  // এখন specifications collection এর proper field names ব্যবহার হবে
  if (findProduct?.specifications) {
    findProduct.specifications = findProduct?.specifications?.map(
      (specification: any) => {
        const { specification_id, specification_values } = specification;

        const filteredValues = specification_id?.specification_values?.filter(
          (value: any) =>
            specification_values?.some(
              (specValue: any) =>
                specValue?.specification_value_id?.toString() ===
                value?._id?.toString(),
            ),
        );

        return {
          _id: specification?._id,
          specification_id: {
            _id: specification_id?._id,
            specification_name: specification_id?.specification_name, // ✅ fix
            specification_status: specification_id?.specification_status, // ✅ fix
            specification_values: filteredValues?.map((value: any) => ({
              _id: value?._id,
              specification_value_name: value?.specification_value_name, // ✅ fix
              specification_value_status: value?.specification_value_status, // ✅ fix
            })),
          },
        };
      },
    );
  }

  // Step 8: Review + Order count
  const total_order_count: any = await OrderProductModel.countDocuments({
    product_id: targetProductId,
  });

  const averageReview = await ReviewModel.aggregate([
    { $match: { review_product_id: targetProductId } },
    {
      $group: {
        _id: "$review_product_id",
        averageRating: { $avg: "$review_ratting" },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  findProduct.avarage_review_ratting =
    averageReview.length > 0 ? averageReview[0].averageRating : 0;
  findProduct.total_review_ratting =
    averageReview.length > 0 ? averageReview[0].totalReviews : 0;
  findProduct.total_order_count = total_order_count ?? 0;

  return { data: findProduct, redirect_slug: null };
};
// Find cart Product
export const findCartProductServices = async (
  products: any,
): Promise<any | null> => {
  if (!products?.length) return [];

  // ── Step 1: IDs collect ────────────────────────────────────
  const productIds = [...new Set(products.map((p: any) => p.product_id))].map(
    (id: any) => new Types.ObjectId(id as string),
  );

  const variationIds = products
    .filter((p: any) => p.variation_id)
    .map((p: any) => new Types.ObjectId(p.variation_id as string));

  // ── Step 2: একটাই query তে সব product ─────────────────────
  const foundProducts: any[] = await ProductModel.find({
    _id: { $in: productIds },
    product_status: "active",
  })
    .populate([
      { path: "brand_id", model: "brands" },
      // { path: "product_campaign_id", model: "campaigns" },
      { path: "category_id", model: "categories" },
      { path: "sub_category_id", model: "subcategories" },
      // { path: "child_category_id", model: "childcategories" },
    ])
    .select(
      "-__v -barcode -barcode_image -product_publisher_id -product_by -product_supplier_id -product_buying_price -product_alert_quantity -createdAt -updatedAt -category_id -sub_category_id -specifications -product_sku -description -other_images -main_image_key -meta_title -meta_description -meta_keywords -attributes_details",
    )
    .lean();

  // ── Step 3: একটাই query তে সব variation ───────────────────
  const foundVariations: any[] = variationIds.length
    ? await VariationModel.find({ _id: { $in: variationIds } })
        .select(
          "-__v -variation_buying_price -variation_alert_quantity -variation_barcode -variation_barcode_image -variation_image_key -variation_sku -createdAt -updatedAt",
        )
        .lean()
    : [];

  const variationById = new Map<string, any>();
  foundVariations.forEach((v) => variationById.set(v._id.toString(), v));

  // ── Step 4: একটাই aggregate তে সব review ──────────────────
  const reviewAggregates = await ReviewModel.aggregate([
    { $match: { review_product_id: { $in: productIds } } },
    {
      $group: {
        _id: "$review_product_id",
        averageRating: { $avg: "$review_ratting" },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  const reviewMap = new Map<string, any>();
  reviewAggregates.forEach((r) => reviewMap.set(r._id.toString(), r));

  // product কে Map এ রাখো
  const productById = new Map<string, any>();
  foundProducts.forEach((p) => productById.set(p._id.toString(), p));

  // ── Step 5: প্রতিটা cart item এর জন্য আলাদা entry ─────────
  const productDetails: any[] = [];

  for (const cartItem of products) {
    const productIdStr = cartItem.product_id;
    const baseProduct = productById.get(productIdStr);

    if (!baseProduct) continue;

    // inactive check
    if (baseProduct?.category_id?.category_status !== "active") continue;
    if (
      baseProduct?.sub_category_id &&
      baseProduct?.sub_category_id?.sub_category_status !== "active"
    )
      continue;
    if (
      baseProduct?.brand_id &&
      baseProduct?.brand_id?.brand_status !== "active"
    )
      continue;

    // ✅ deep copy — same product এর দুটো variation আলাদা object হবে
    const findProduct: any = { ...baseProduct };

    // category/sub_category cleanup
    delete findProduct.category_id;
    delete findProduct.sub_category_id;

    // brand cleanup
    if (findProduct?.brand_id) {
      findProduct.brand_id = {
        _id: findProduct.brand_id._id,
        brand_name: findProduct.brand_id.brand_name,
      };
    }

    // cart quantity
    if (cartItem?.quantity) {
      findProduct.cartQuantity = cartItem.quantity;
    }

    // variation attach
    if (findProduct?.is_variation && cartItem?.variation_id) {
      findProduct.variations = variationById.get(cartItem.variation_id) || null;
    }

    // review attach
    const review = reviewMap.get(productIdStr);
    findProduct.avarage_review_ratting = review?.averageRating || 0;
    findProduct.total_review_ratting = review?.totalReviews || 0;

    productDetails.push(findProduct);
  }

  return productDetails;
};

// Find Compare Product
export const findCompareProductServices = async (
  products: any,
): Promise<any | null> => {
  const productDetails: any = [];

  for (const product of products) {
    // Step 1: Find the product by its ID and populate related fields
    const findProduct: any = await ProductModel.findOne({
      _id: product?.product_id,
    })
      .populate([
        { path: "brand_id", model: "brands" },
        { path: "category_id", model: "categories" },
        {
          path: "specifications.specification_id",
          model: "specifications",
        },
      ])
      .select(
        "product_name product_slug category_id brand_id specifications main_image unit product_warrenty product_return",
      )
      .lean();

    if (!findProduct) {
      continue;
    }

    // product if for campaign and flash sale
    const targetProductId = findProduct?._id;

    if (findProduct?.brand_id) {
      findProduct.brand_id = {
        _id: findProduct?.brand_id?._id,
        brand_name: findProduct?.brand_id?.brand_name,
      };
    }
    if (findProduct?.category_id) {
      findProduct.category_id = {
        _id: findProduct?.category_id?._id,
        category_name: findProduct?.category_id?.category_name,
        category_slug: findProduct?.category_id?.category_slug,
      };
    }

    if (findProduct?.specifications) {
      findProduct.specifications = findProduct?.specifications?.map(
        (specification: any) => {
          const { specification_id, specification_values } = specification;

          // Filter `specification_id.specification_values` based on `specification_values`
          const filteredValues = specification_id?.attribute_values?.filter(
            (value: any) =>
              specification_values?.some(
                (specValue: any) =>
                  specValue?.specification_value_id?.toString() ===
                  value?._id?.toString(),
              ),
          );

          return {
            _id: specification?._id,
            specification_id: {
              _id: specification_id?._id,
              specification_name: specification_id?.specification_name,
              specification_status: specification_id?.specification_status,
              specification_values: filteredValues?.map((value: any) => ({
                _id: value?._id,
                specification_value_name: value?.specification_value_name,
                specification_value_status: value?.specification_value_status,
              })),
            },
          };
        },
      );
    }

    let avarage_review_ratting: any = 0;
    let total_review_ratting: any = 0;

    const averageReview = await ReviewModel.aggregate([
      {
        $match: {
          review_product_id: targetProductId,
        },
      },
      {
        $group: {
          _id: "$review_product_id",
          averageRating: { $avg: "$review_ratting" },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    if (averageReview.length > 0) {
      avarage_review_ratting = averageReview[0].averageRating;
      total_review_ratting = averageReview[0].totalReviews;
      // console.log(`Average Rating: ${averageReview[0].averageRating}`);
      // console.log(`Total Reviews: ${averageReview[0].totalReviews}`);
    }

    const total_order_count: any = await OrderProductModel.countDocuments({
      product_id: targetProductId,
    });

    findProduct.avarage_review_ratting = avarage_review_ratting;
    findProduct.total_review_ratting = total_review_ratting;
    findProduct.total_order_count = total_order_count;

    productDetails?.push({
      ...findProduct,
    });
  }

  return productDetails;
};

// Find RelatedProduct

export const findRelatedProductServices = async (
  product_slug: any,
): Promise<IProductInterface[] | []> => {
  const andCondition = [];

  if (product_slug) {
    // Extracting keywords from the product_slug to find related items
    const keywords = product_slug
      .split("-")
      .filter((word: any) => word.length > 2); // Ignore very short words
    // Match any of the keywords in the product_name or product_slug fields
    if (keywords.length) {
      andCondition.push({
        $or: keywords.map((keyword: any) => ({
          $or: [
            {
              product_name: {
                $regex: keyword,
                $options: "i", // Case-insensitive
              },
            },
            {
              product_slug: {
                $regex: keyword,
                $options: "i", // Case-insensitive
              },
            },
          ],
        })),
      });
    }
  }

  andCondition.push({
    product_status: "active", // Filter for active products
  });

  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};

  const findRelatedProduct = await ProductModel.aggregate([
    {
      $match: {
        ...whereCondition, // Filter for active products
      },
    },
    {
      $sample: {
        size: 10,
      },
    },
    {
      $lookup: {
        from: "categories", // Link the product's category
        localField: "category_id",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $unwind: {
        path: "$category",
        preserveNullAndEmptyArrays: false, // Only include products with a valid category
      },
    },
    {
      $lookup: {
        from: "subcategories", // Link the product's sub-category
        localField: "sub_category_id",
        foreignField: "_id",
        as: "sub_category",
      },
    },
    {
      $unwind: {
        path: "$sub_category",
        preserveNullAndEmptyArrays: true, // Include products even if sub-category details are not available
      },
    },
    {
      $lookup: {
        from: "brands", // Link the product's brand
        localField: "brand_id",
        foreignField: "_id",
        as: "brand",
      },
    },
    {
      $unwind: {
        path: "$brand",
        preserveNullAndEmptyArrays: true, // Include products even if brand details are not available
      },
    },
    {
      $lookup: {
        from: "variations", // Link the product's variations
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
              variation_quantity: "$$variation.variation_quantity",
              variation_image: "$$variation.variation_image",
              variation_video: "$$variation.variation_video",
            },
          },
        },
      },
    },
    {
      $lookup: {
        from: "reviews", // Join with reviews collection
        localField: "_id",
        foreignField: "review_product_id",
        as: "reviews",
      },
    },
    {
      $addFields: {
        average_review_rating: {
          $cond: {
            if: { $gt: [{ $size: "$reviews" }, 0] }, // Check if reviews exist
            then: {
              $divide: [
                { $sum: "$reviews.review_ratting" }, // Sum of all review ratings
                { $size: "$reviews" }, // Total number of reviews
              ],
            },
            else: 0, // Default to 0 if no reviews
          },
        },
        total_reviews: { $size: "$reviews" }, // Count of reviews
      },
    },
    {
      $match: {
        "category.category_status": "active", // Ensure the category is active
        $and: [
          {
            $or: [
              { "sub_category.sub_category_status": "active" }, // Allow active sub-category
              { sub_category: null }, // Or no sub-category
            ],
          },
          {
            $or: [
              { "brand.brand_status": "active" }, // Allow active brand
              { brand: null }, // Or no brand
            ],
          },
        ],
      },
    },
    {
      $project: {
        _id: 1,
        product_name: 1,
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
                then: "$$REMOVE", // Removes `attributes_details` if empty
                else: {
                  $cond: {
                    if: { $eq: [{ $size: "$$filteredAttributes" }, 1] },
                    then: { $arrayElemAt: ["$$filteredAttributes", 0] }, // Send as object if length = 1
                    else: "$$filteredAttributes", // Send as array if length > 1
                  },
                },
              },
            },
          },
        },
        product_slug: 1,
        main_image: 1,
        other_images: {
          $cond: {
            if: { $eq: ["$is_variation", false] },
            then: { $arrayElemAt: ["$other_images", 0] },
            else: "$$REMOVE",
          },
        },
        main_video: 1,
        product_price: 1,
        product_discount_price: 1,
        createdAt: 1,
        updatedAt: 1,
        brand: {
          _id: 1,
          brand_name: 1,
        },
        category: {
          _id: 1,
          category_name: 1,
        },
        is_variation: 1,
        variations: {
          $cond: {
            if: { $eq: ["$is_variation", true] }, // Only include variations if is_variation is true
            then: { $arrayElemAt: ["$variations", 0] }, // Include only the first variation
            else: {}, // Set variations to an empty array if is_variation is false
          },
        },
        average_review_rating: 1, // Include average rating
        total_reviews: 1, // Include total reviews coun
      },
    },
  ]);

  return findRelatedProduct;
};

// export const findRelatedProductServices = async (
//   product_slug: string
// ): Promise<IProductInterface[] | []> => {
//   const andCondition = [];

//   if (product_slug) {
//     // Extracting keywords from the product_slug to find related items
//     const keywords = product_slug.split("-").filter((word) => word.length > 2); // Ignore very short words
//     // Match any of the keywords in the product_name or product_slug fields
//     if (keywords.length) {
//       andCondition.push({
//         $or: keywords.map((keyword) => ({
//           $or: [
//             {
//               product_name: {
//                 $regex: keyword,
//                 $options: "i", // Case-insensitive
//               },
//             },
//             {
//               product_slug: {
//                 $regex: keyword,
//                 $options: "i", // Case-insensitive
//               },
//             },
//           ],
//         })),
//       });
//     }
//   }

//   andCondition.push({
//     product_status: "active", // Filter for active products
//   });

//   const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};

//   const findRelatedProduct = await ProductModel.aggregate([
//     {
//       $match: {
//         ...whereCondition, // Filter for active products
//       },
//     },
//     {
//       $sample: { size: 10 }, // Randomly select 10 products
//     },
//     {
//       $lookup: {
//         from: "categories", // Link the product's category
//         localField: "category_id",
//         foreignField: "_id",
//         as: "category",
//       },
//     },
//     {
//       $unwind: {
//         path: "$category",
//         preserveNullAndEmptyArrays: false, // Only include products with a valid category
//       },
//     },
//     {
//       $lookup: {
//         from: "subcategories", // Link the product's sub-category
//         localField: "sub_category_id",
//         foreignField: "_id",
//         as: "sub_category",
//       },
//     },
//     {
//       $unwind: {
//         path: "$sub_category",
//         preserveNullAndEmptyArrays: true, // Include products even if sub-category details are not available
//       },
//     },
//     {
//       $lookup: {
//         from: "childcategories", // Link the product's child-category
//         localField: "child_category_id",
//         foreignField: "_id",
//         as: "child_category",
//       },
//     },
//     {
//       $unwind: {
//         path: "$child_category",
//         preserveNullAndEmptyArrays: true, // Include products even if child-category details are not available
//       },
//     },
//     {
//       $lookup: {
//         from: "brands", // Link the product's brand
//         localField: "brand_id",
//         foreignField: "_id",
//         as: "brand",
//       },
//     },
//     {
//       $unwind: {
//         path: "$brand",
//         preserveNullAndEmptyArrays: true, // Include products even if brand details are not available
//       },
//     },
//     {
//       $lookup: {
//         from: "variations", // Link the product's variations
//         localField: "_id",
//         foreignField: "product_id",
//         as: "variations",
//       },
//     },
//     {
//       $addFields: {
//         variations: {
//           $map: {
//             input: "$variations",
//             as: "variation",
//             in: {
//               _id: "$$variation._id",
//               variation_name: "$$variation.variation_name",
//               product_id: "$$variation.product_id",
//               variation_price: "$$variation.variation_price",
//               variation_discount_price: "$$variation.variation_discount_price",
//               variation_quantity: "$$variation.variation_quantity",
//               variation_image: "$$variation.variation_image",
//               variation_video: "$$variation.variation_video",
//             },
//           },
//         },
//       },
//     },
//     {
//       $lookup: {
//         from: "reviews", // Join with reviews collection
//         localField: "_id",
//         foreignField: "review_product_id",
//         as: "reviews",
//       },
//     },
//     {
//       $addFields: {
//         average_review_rating: {
//           $cond: {
//             if: { $gt: [{ $size: "$reviews" }, 0] }, // Check if reviews exist
//             then: {
//               $divide: [
//                 { $sum: "$reviews.review_ratting" }, // Sum of all review ratings
//                 { $size: "$reviews" }, // Total number of reviews
//               ],
//             },
//             else: 0, // Default to 0 if no reviews
//           },
//         },
//         total_reviews: { $size: "$reviews" }, // Count of reviews
//       },
//     },
//     {
//       $match: {
//         "category.category_status": "active", // Ensure the category is active
//         $and: [
//           {
//             $or: [
//               { "sub_category.sub_category_status": "active" }, // Allow active sub-category
//               { sub_category: null }, // Or no sub-category
//             ],
//           },
//           {
//             $or: [
//               { "child_category.child_category_status": "active" }, // Allow active child-category
//               { child_category: null }, // Or no child-category
//             ],
//           },
//           {
//             $or: [
//               { "brand.brand_status": "active" }, // Allow active brand
//               { brand: null }, // Or no brand
//             ],
//           },
//         ],
//       },
//     },
//     {
//       $lookup: {
//         from: "campaigns", // Link the product's campaign
//         localField: "product_campaign_id",
//         foreignField: "_id",
//         as: "campaign",
//       },
//     },
//     {
//       $unwind: {
//         path: "$campaign",
//         preserveNullAndEmptyArrays: true, // Include products even if campaign details are not available
//       },
//     },
//     {
//       $addFields: {
//         campaign_details: {
//           $cond: {
//             if: {
//               $and: [
//                 { $ne: ["$campaign", null] }, // Check if campaign exists
//                 { $ne: ["$campaign.campaign_products", null] },
//                 { $eq: ["$campaign.campaign_status", "active"] }, // Check if campaign_status is active
//                 {
//                   $gt: [
//                     {
//                       $size: {
//                         $filter: {
//                           input: "$campaign.campaign_products",
//                           as: "product",
//                           cond: {
//                             $and: [
//                               {
//                                 $eq: ["$$product.campaign_product_id", "$_id"],
//                               }, // Match product ID
//                               {
//                                 $eq: [
//                                   "$$product.campaign_product_status",
//                                   "active",
//                                 ],
//                               }, // Check product status is active
//                             ],
//                           },
//                         },
//                       },
//                     },
//                     0,
//                   ],
//                 }, // Ensure at least one matching campaign product exists
//               ],
//             },
//             then: {
//               _id: "$campaign._id",
//               campaign_start_date: "$campaign.campaign_start_date",
//               campaign_end_date: "$campaign.campaign_end_date",
//               campaign_status: "$campaign.campaign_status",
//               campaign_product: {
//                 $arrayElemAt: [
//                   {
//                     $filter: {
//                       input: "$campaign.campaign_products",
//                       as: "product",
//                       cond: {
//                         $and: [
//                           { $eq: ["$$product.campaign_product_id", "$_id"] }, // Match product ID
//                           {
//                             $eq: [
//                               "$$product.campaign_product_status",
//                               "active",
//                             ],
//                           }, // Check product status is active
//                         ],
//                       },
//                     },
//                   },
//                   0,
//                 ],
//               },
//             },
//             else: null,
//           },
//         },
//       },
//     },
//     {
//       $project: {
//         _id: 1,
//         product_name: 1,
//         attributes_details: {
//           $let: {
//             vars: {
//               filteredAttributes: {
//                 $filter: {
//                   input: "$attributes_details",
//                   as: "attribute",
//                   cond: {
//                     $gt: [
//                       {
//                         $size: {
//                           $filter: {
//                             input: "$$attribute.attribute_values",
//                             as: "value",
//                             cond: {
//                               $and: [
//                                 { $ne: ["$$value.attribute_value_code", null] },
//                                 {
//                                   $ne: [
//                                     "$$value.attribute_value_code",
//                                     "undefined",
//                                   ],
//                                 },
//                                 { $ne: ["$$value.attribute_value_code", ""] },
//                               ],
//                             },
//                           },
//                         },
//                       },
//                       0,
//                     ],
//                   },
//                 },
//               },
//             },
//             in: {
//               $cond: {
//                 if: { $eq: [{ $size: "$$filteredAttributes" }, 0] },
//                 then: "$$REMOVE", // Removes `attributes_details` if empty
//                 else: {
//                   $cond: {
//                     if: { $eq: [{ $size: "$$filteredAttributes" }, 1] },
//                     then: { $arrayElemAt: ["$$filteredAttributes", 0] }, // Send as object if length = 1
//                     else: "$$filteredAttributes", // Send as array if length > 1
//                   },
//                 },
//               },
//             },
//           },
//         },
//         product_slug: 1,
//         main_image: 1,
//         other_images: {
//           $cond: {
//             if: { $eq: ["$is_variation", false] },
//             then: { $arrayElemAt: ["$other_images", 0] },
//             else: "$$REMOVE",
//           },
//         },
//         main_video: 1,
//         product_price: 1,
//         product_discount_price: 1,
//         createdAt: 1,
//         updatedAt: 1,
//         brand: {
//           _id: 1,
//           brand_name: 1,
//         },
//         category: {
//           _id: 1,
//           category_name: 1,
//         },
//         is_variation: 1,
//         variations: {
//           $cond: {
//             if: { $eq: ["$is_variation", true] }, // Only include variations if is_variation is true
//             then: { $arrayElemAt: ["$variations", 0] }, // Include only the first variation
//             else: {}, // Set variations to an empty array if is_variation is false
//           },
//         },
//         // campaign_details: 1,
//         campaign_details: {
//           $cond: {
//             if: { $ne: ["$campaign_details.campaign_product", null] },
//             then: "$campaign_details",
//             else: null,
//           },
//         },
//         average_review_rating: 1, // Include average rating
//         total_reviews: 1, // Include total reviews coun
//       },
//     },
//   ]);

//   return findRelatedProduct;
// };

// Find trendingProduct
export const findTrendingProductServices = async (
  limit: number,
  skip: number,
): Promise<IProductInterface[] | [] | any> => {
  // Step 1: Count total data
  const totalData = await ProductModel.aggregate([
    {
      $match: {
        product_status: "active", // Filter for active products
        trending_product: true, // Filter for active products
      },
    },
    {
      $lookup: {
        from: "categories",
        localField: "category_id",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $unwind: {
        path: "$category",
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $lookup: {
        from: "subcategories",
        localField: "sub_category_id",
        foreignField: "_id",
        as: "sub_category",
      },
    },
    {
      $unwind: {
        path: "$sub_category",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "childcategories",
        localField: "child_category_id",
        foreignField: "_id",
        as: "child_category",
      },
    },
    {
      $unwind: {
        path: "$child_category",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "brands",
        localField: "brand_id",
        foreignField: "_id",
        as: "brand",
      },
    },
    {
      $unwind: {
        path: "$brand",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $match: {
        "category.category_status": "active",
        $and: [
          {
            $or: [
              { "sub_category.sub_category_status": "active" },
              { sub_category: null },
            ],
          },
          {
            $or: [
              { "child_category.child_category_status": "active" },
              { child_category: null },
            ],
          },
          {
            $or: [{ "brand.brand_status": "active" }, { brand: null }],
          },
        ],
      },
    },
    {
      $count: "total",
    },
  ]);

  // Extract the total count
  const totalCount: any = totalData.length > 0 ? totalData[0].total : 0;

  const findTrendingProduct = await ProductModel.aggregate([
    {
      $match: {
        product_status: "active", // Filter for active products
        trending_product: true, // Filter for active products
      },
    },
    // {
    //   $sample: { size: 10 }, // Randomly select 10 products
    // },
    {
      $lookup: {
        from: "categories", // Link the product's category
        localField: "category_id",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $unwind: {
        path: "$category",
        preserveNullAndEmptyArrays: false, // Only include products with a valid category
      },
    },
    {
      $lookup: {
        from: "subcategories", // Link the product's sub-category
        localField: "sub_category_id",
        foreignField: "_id",
        as: "sub_category",
      },
    },
    {
      $unwind: {
        path: "$sub_category",
        preserveNullAndEmptyArrays: true, // Include products even if sub-category details are not available
      },
    },
    {
      $lookup: {
        from: "childcategories", // Link the product's child-category
        localField: "child_category_id",
        foreignField: "_id",
        as: "child_category",
      },
    },
    {
      $unwind: {
        path: "$child_category",
        preserveNullAndEmptyArrays: true, // Include products even if child-category details are not available
      },
    },
    {
      $lookup: {
        from: "brands", // Link the product's brand
        localField: "brand_id",
        foreignField: "_id",
        as: "brand",
      },
    },
    {
      $unwind: {
        path: "$brand",
        preserveNullAndEmptyArrays: true, // Include products even if brand details are not available
      },
    },
    {
      $lookup: {
        from: "variations", // Link the product's variations
        localField: "_id",
        foreignField: "product_id",
        as: "variations",
      },
    },
    {
      $lookup: {
        from: "reviews", // Join with reviews collection
        localField: "_id",
        foreignField: "review_product_id",
        as: "reviews",
      },
    },
    {
      $addFields: {
        average_review_rating: {
          $cond: {
            if: { $gt: [{ $size: "$reviews" }, 0] }, // Check if reviews exist
            then: {
              $divide: [
                { $sum: "$reviews.review_ratting" }, // Sum of all review ratings
                { $size: "$reviews" }, // Total number of reviews
              ],
            },
            else: 0, // Default to 0 if no reviews
          },
        },
        total_reviews: { $size: "$reviews" }, // Count of reviews
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
              variation_quantity: "$$variation.variation_quantity",
              variation_image: "$$variation.variation_image",
              variation_video: "$$variation.variation_video",
            },
          },
        },
      },
    },
    // {
    //   $addFields: {
    //     attributes_details: {
    //       $map: {
    //         input: "$attributes_details",
    //         as: "attr",
    //         in: {
    //           attribute_name: "$$attr.attribute_name",
    //           attribute_values: {
    //             $filter: {
    //               input: "$$attr.attribute_values",
    //               as: "value",
    //               cond: {
    //                 $and: [
    //                   { $ne: ["$$value.attribute_value_code", null] },
    //                   { $ne: ["$$value.attribute_value_code", "undefined"] },
    //                   { $ne: ["$$value.attribute_value_code", ""] }
    //                 ]
    //               }
    //             }
    //           }
    //         }
    //       }
    //     }
    //   }
    // },
    {
      $match: {
        "category.category_status": "active", // Ensure the category is active
        $and: [
          {
            $or: [
              { "sub_category.sub_category_status": "active" }, // Allow active sub-category
              { sub_category: null }, // Or no sub-category
            ],
          },
          {
            $or: [
              { "child_category.child_category_status": "active" }, // Allow active child-category
              { child_category: null }, // Or no child-category
            ],
          },
          {
            $or: [
              { "brand.brand_status": "active" }, // Allow active brand
              { brand: null }, // Or no brand
            ],
          },
        ],
      },
    },
    {
      $lookup: {
        from: "campaigns", // Link the product's campaign
        localField: "product_campaign_id",
        foreignField: "_id",
        as: "campaign",
      },
    },
    {
      $unwind: {
        path: "$campaign",
        preserveNullAndEmptyArrays: true, // Include products even if campaign details are not available
      },
    },
    {
      $addFields: {
        campaign_details: {
          $cond: {
            if: {
              $and: [
                { $ne: ["$campaign", null] }, // Check if campaign exists
                { $ne: ["$campaign.campaign_products", null] },
                { $eq: ["$campaign.campaign_status", "active"] }, // Check if campaign_status is active
                {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: "$campaign.campaign_products",
                          as: "product",
                          cond: {
                            $and: [
                              {
                                $eq: ["$$product.campaign_product_id", "$_id"],
                              }, // Match product ID
                              {
                                $eq: [
                                  "$$product.campaign_product_status",
                                  "active",
                                ],
                              }, // Check product status is active
                            ],
                          },
                        },
                      },
                    },
                    0,
                  ],
                }, // Ensure at least one matching campaign product exists
              ],
            },
            then: {
              _id: "$campaign._id",
              campaign_start_date: "$campaign.campaign_start_date",
              campaign_end_date: "$campaign.campaign_end_date",
              campaign_status: "$campaign.campaign_status",
              campaign_product: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$campaign.campaign_products",
                      as: "product",
                      cond: {
                        $and: [
                          { $eq: ["$$product.campaign_product_id", "$_id"] }, // Match product ID
                          {
                            $eq: [
                              "$$product.campaign_product_status",
                              "active",
                            ],
                          }, // Check product status is active
                        ],
                      },
                    },
                  },
                  0,
                ],
              },
            },
            else: null,
          },
        },
      },
    },
    {
      $project: {
        _id: 1,
        // attributes_details: {
        //   $filter: {
        //     input: "$attributes_details",
        //     as: "attribute",
        //     cond: {
        //       $gt: [
        //         {
        //           $size: {
        //             $filter: {
        //               input: "$$attribute.attribute_values",
        //               as: "value",
        //               cond: {
        //                 $and: [
        //                   { $ne: ["$$value.attribute_value_code", null] },
        //                   {
        //                     $ne: ["$$value.attribute_value_code", "undefined"],
        //                   },
        //                   { $ne: ["$$value.attribute_value_code", ""] },
        //                 ],
        //               },
        //             },
        //           },
        //         },
        //         0,
        //       ],
        //     },
        //   },
        // },
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
                then: "$$REMOVE", // Removes `attributes_details` if empty
                else: {
                  $cond: {
                    if: { $eq: [{ $size: "$$filteredAttributes" }, 1] },
                    then: { $arrayElemAt: ["$$filteredAttributes", 0] }, // Send as object if length = 1
                    else: "$$filteredAttributes", // Send as array if length > 1
                  },
                },
              },
            },
          },
        },
        product_name: 1,
        other_images: {
          $cond: {
            if: { $eq: ["$is_variation", false] },
            then: { $arrayElemAt: ["$other_images", 0] },
            else: "$$REMOVE",
          },
        },
        // other_images: 1,
        product_slug: 1,
        main_image: 1,
        main_video: 1,
        product_price: 1,
        product_discount_price: 1,
        createdAt: 1,
        updatedAt: 1,
        category: {
          _id: 1,
          category_name: 1,
          category_slug: 1,
        },
        brand: {
          _id: 1,
          brand_name: 1,
        },
        is_variation: 1,
        variations: {
          $cond: {
            if: { $eq: ["$is_variation", true] }, // Only include variations if is_variation is true
            then: { $arrayElemAt: ["$variations", 0] }, // Include only the first variation
            else: {}, // Set variations to an empty array if is_variation is false
          },
        },
        campaign_details: {
          $cond: {
            if: { $ne: ["$campaign_details.campaign_product", null] },
            then: "$campaign_details",
            else: null,
          },
        },
        average_review_rating: 1, // Include average rating
        total_reviews: 1, // Include total reviews coun
      },
    },
    {
      $sort: {
        _id: -1,
      },
    },
    {
      $skip: skip, // Skip the number of documents
    },
    {
      $limit: limit, // Limit the number of documents
    },
  ]);

  // Return both the data and total count
  return {
    data: findTrendingProduct,
    totalData: totalCount,
  };
};

// Find BrandMatchProduct
export const findBrandMatchProductServices = async (
  limit: number,
  skip: number,
  brand_id: any,
): Promise<IProductInterface[] | [] | any> => {
  const brandDetails = await BrandModel.findOne({ _id: brand_id });

  const brandObjectId = Types.ObjectId.isValid(brand_id)
    ? { brand_id: new Types.ObjectId(brand_id) }
    : { brand_id };

  // Step 1: Count total data
  const totalData = await ProductModel.aggregate([
    {
      $match: {
        product_status: "active", // Filter for active products
        trending_product: true, // Filter for active products
        brand_id: new Types.ObjectId(brand_id),
      },
    },
    {
      $lookup: {
        from: "categories",
        localField: "category_id",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $unwind: {
        path: "$category",
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $lookup: {
        from: "subcategories",
        localField: "sub_category_id",
        foreignField: "_id",
        as: "sub_category",
      },
    },
    {
      $unwind: {
        path: "$sub_category",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $match: {
        "category.category_status": "active",
        $and: [
          {
            $or: [
              { "sub_category.sub_category_status": "active" },
              { sub_category: null },
            ],
          },
        ],
      },
    },
    {
      $count: "total",
    },
  ]);

  // Extract the total count
  const totalCount: any = totalData.length > 0 ? totalData[0].total : 0;

  const findTrendingProduct = await ProductModel.aggregate([
    {
      $match: {
        product_status: "active", // Filter for active products
        trending_product: true, // Filter for active products
        brand_id: new Types.ObjectId(brand_id),
      },
    },
    // {
    //   $sample: { size: 10 }, // Randomly select 10 products
    // },
    {
      $lookup: {
        from: "categories", // Link the product's category
        localField: "category_id",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $unwind: {
        path: "$category",
        preserveNullAndEmptyArrays: false, // Only include products with a valid category
      },
    },
    {
      $lookup: {
        from: "subcategories", // Link the product's sub-category
        localField: "sub_category_id",
        foreignField: "_id",
        as: "sub_category",
      },
    },
    {
      $unwind: {
        path: "$sub_category",
        preserveNullAndEmptyArrays: true, // Include products even if sub-category details are not available
      },
    },
    {
      $lookup: {
        from: "brands", // Link the product's brand
        localField: "brand_id",
        foreignField: "_id",
        as: "brand",
      },
    },
    {
      $unwind: {
        path: "$brand",
        preserveNullAndEmptyArrays: true, // Include products even if brand details are not available
      },
    },
    {
      $lookup: {
        from: "variations", // Link the product's variations
        localField: "_id",
        foreignField: "product_id",
        as: "variations",
      },
    },
    {
      $lookup: {
        from: "reviews", // Join with reviews collection
        localField: "_id",
        foreignField: "review_product_id",
        as: "reviews",
      },
    },
    {
      $addFields: {
        average_review_rating: {
          $cond: {
            if: { $gt: [{ $size: "$reviews" }, 0] }, // Check if reviews exist
            then: {
              $divide: [
                { $sum: "$reviews.review_ratting" }, // Sum of all review ratings
                { $size: "$reviews" }, // Total number of reviews
              ],
            },
            else: 0, // Default to 0 if no reviews
          },
        },
        total_reviews: { $size: "$reviews" }, // Count of reviews
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
              variation_quantity: "$$variation.variation_quantity",
              variation_image: "$$variation.variation_image",
              variation_video: "$$variation.variation_video",
            },
          },
        },
      },
    },
    // {
    //   $addFields: {
    //     attributes_details: {
    //       $map: {
    //         input: "$attributes_details",
    //         as: "attr",
    //         in: {
    //           attribute_name: "$$attr.attribute_name",
    //           attribute_values: {
    //             $filter: {
    //               input: "$$attr.attribute_values",
    //               as: "value",
    //               cond: {
    //                 $and: [
    //                   { $ne: ["$$value.attribute_value_code", null] },
    //                   { $ne: ["$$value.attribute_value_code", "undefined"] },
    //                   { $ne: ["$$value.attribute_value_code", ""] }
    //                 ]
    //               }
    //             }
    //           }
    //         }
    //       }
    //     }
    //   }
    // },
    {
      $match: {
        "category.category_status": "active", // Ensure the category is active
        $and: [
          {
            $or: [
              { "sub_category.sub_category_status": "active" }, // Allow active sub-category
              { sub_category: null }, // Or no sub-category
            ],
          },
        ],
      },
    },
    {
      $lookup: {
        from: "campaigns", // Link the product's campaign
        localField: "product_campaign_id",
        foreignField: "_id",
        as: "campaign",
      },
    },
    {
      $unwind: {
        path: "$campaign",
        preserveNullAndEmptyArrays: true, // Include products even if campaign details are not available
      },
    },
    {
      $addFields: {
        campaign_details: {
          $cond: {
            if: {
              $and: [
                { $ne: ["$campaign", null] }, // Check if campaign exists
                { $ne: ["$campaign.campaign_products", null] },
                { $eq: ["$campaign.campaign_status", "active"] }, // Check if campaign_status is active
                {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: "$campaign.campaign_products",
                          as: "product",
                          cond: {
                            $and: [
                              {
                                $eq: ["$$product.campaign_product_id", "$_id"],
                              }, // Match product ID
                              {
                                $eq: [
                                  "$$product.campaign_product_status",
                                  "active",
                                ],
                              }, // Check product status is active
                            ],
                          },
                        },
                      },
                    },
                    0,
                  ],
                }, // Ensure at least one matching campaign product exists
              ],
            },
            then: {
              _id: "$campaign._id",
              campaign_start_date: "$campaign.campaign_start_date",
              campaign_end_date: "$campaign.campaign_end_date",
              campaign_status: "$campaign.campaign_status",
              campaign_product: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$campaign.campaign_products",
                      as: "product",
                      cond: {
                        $and: [
                          { $eq: ["$$product.campaign_product_id", "$_id"] }, // Match product ID
                          {
                            $eq: [
                              "$$product.campaign_product_status",
                              "active",
                            ],
                          }, // Check product status is active
                        ],
                      },
                    },
                  },
                  0,
                ],
              },
            },
            else: null,
          },
        },
      },
    },
    {
      $project: {
        _id: 1,
        // attributes_details: {
        //   $filter: {
        //     input: "$attributes_details",
        //     as: "attribute",
        //     cond: {
        //       $gt: [
        //         {
        //           $size: {
        //             $filter: {
        //               input: "$$attribute.attribute_values",
        //               as: "value",
        //               cond: {
        //                 $and: [
        //                   { $ne: ["$$value.attribute_value_code", null] },
        //                   {
        //                     $ne: ["$$value.attribute_value_code", "undefined"],
        //                   },
        //                   { $ne: ["$$value.attribute_value_code", ""] },
        //                 ],
        //               },
        //             },
        //           },
        //         },
        //         0,
        //       ],
        //     },
        //   },
        // },
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
                then: "$$REMOVE", // Removes `attributes_details` if empty
                else: {
                  $cond: {
                    if: { $eq: [{ $size: "$$filteredAttributes" }, 1] },
                    then: { $arrayElemAt: ["$$filteredAttributes", 0] }, // Send as object if length = 1
                    else: "$$filteredAttributes", // Send as array if length > 1
                  },
                },
              },
            },
          },
        },
        product_name: 1,
        other_images: {
          $cond: {
            if: { $eq: ["$is_variation", false] },
            then: { $arrayElemAt: ["$other_images", 0] },
            else: "$$REMOVE",
          },
        },
        // other_images: 1,
        product_slug: 1,
        main_image: 1,
        main_video: 1,
        product_price: 1,
        product_discount_price: 1,
        createdAt: 1,
        updatedAt: 1,
        category: {
          _id: 1,
          category_name: 1,
          category_slug: 1,
        },
        brand: {
          _id: 1,
          brand_name: 1,
        },
        is_variation: 1,
        variations: {
          $cond: {
            if: { $eq: ["$is_variation", true] }, // Only include variations if is_variation is true
            then: { $arrayElemAt: ["$variations", 0] }, // Include only the first variation
            else: {}, // Set variations to an empty array if is_variation is false
          },
        },
        campaign_details: {
          $cond: {
            if: { $ne: ["$campaign_details.campaign_product", null] },
            then: "$campaign_details",
            else: null,
          },
        },
        average_review_rating: 1, // Include average rating
        total_reviews: 1, // Include total reviews coun
      },
    },
    {
      $sort: {
        _id: -1,
      },
    },
    {
      $skip: skip, // Skip the number of documents
    },
    {
      $limit: limit, // Limit the number of documents
    },
  ]);

  // Return both the data and total count
  return {
    data: findTrendingProduct,
    totalData: totalCount,
    brand_details: brandDetails,
  };
};

// Find PopularProduct

export const findPopularProductServices = async (
  limit: number,
  skip: number,
  category_id: any,
): Promise<IProductInterface[] | []> => {
  if (category_id) {
    // Step 1: Count total data
    const totalData = await ProductModel.aggregate([
      {
        $match: {
          product_status: "active", // Filter for active products
          category_id: new Types.ObjectId(category_id),
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "category_id",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: {
          path: "$category",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $lookup: {
          from: "subcategories",
          localField: "sub_category_id",
          foreignField: "_id",
          as: "sub_category",
        },
      },
      {
        $unwind: {
          path: "$sub_category",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "brands",
          localField: "brand_id",
          foreignField: "_id",
          as: "brand",
        },
      },
      {
        $unwind: {
          path: "$brand",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          "category.category_status": "active",
          $and: [
            {
              $or: [
                { "sub_category.sub_category_status": "active" },
                { sub_category: null },
              ],
            },
            {
              $or: [{ "brand.brand_status": "active" }, { brand: null }],
            },
          ],
        },
      },
      {
        $count: "total",
      },
    ]);

    // Extract the total count
    const totalCount: any = totalData.length > 0 ? totalData[0].total : 0;
    const findCategoryWiseProduct = await ProductModel.aggregate([
      {
        $match: {
          product_status: "active", // Filter for active products
          category_id: new Types.ObjectId(category_id),
        },
      },
      {
        $lookup: {
          from: "categories", // Link the product's category
          localField: "category_id",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: {
          path: "$category",
          preserveNullAndEmptyArrays: false, // Only include products with a valid category
        },
      },
      {
        $lookup: {
          from: "subcategories", // Link the product's sub-category
          localField: "sub_category_id",
          foreignField: "_id",
          as: "sub_category",
        },
      },
      {
        $unwind: {
          path: "$sub_category",
          preserveNullAndEmptyArrays: true, // Include products even if sub-category details are not available
        },
      },
      {
        $lookup: {
          from: "brands", // Link the product's brand
          localField: "brand_id",
          foreignField: "_id",
          as: "brand",
        },
      },
      {
        $unwind: {
          path: "$brand",
          preserveNullAndEmptyArrays: true, // Include products even if brand details are not available
        },
      },
      {
        $lookup: {
          from: "variations", // Link the product's variations
          localField: "_id",
          foreignField: "product_id",
          as: "variations",
        },
      },
      {
        $lookup: {
          from: "reviews", // Join with reviews collection
          localField: "_id",
          foreignField: "review_product_id",
          as: "reviews",
        },
      },
      {
        $addFields: {
          average_review_rating: {
            $cond: {
              if: { $gt: [{ $size: "$reviews" }, 0] }, // Check if reviews exist
              then: {
                $divide: [
                  { $sum: "$reviews.review_ratting" }, // Sum of all review ratings
                  { $size: "$reviews" }, // Total number of reviews
                ],
              },
              else: 0, // Default to 0 if no reviews
            },
          },
          total_reviews: { $size: "$reviews" }, // Count of reviews
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
                variation_discount_price:
                  "$$variation.variation_discount_price",
                variation_quantity: "$$variation.variation_quantity",
                variation_image: "$$variation.variation_image",
                variation_video: "$$variation.variation_video",
              },
            },
          },
        },
      },
      {
        $match: {
          "category.category_status": "active", // Ensure the category is active
          $and: [
            {
              $or: [
                { "sub_category.sub_category_status": "active" }, // Allow active sub-category
                { sub_category: null }, // Or no sub-category
              ],
            },
            {
              $or: [
                { "brand.brand_status": "active" }, // Allow active brand
                { brand: null }, // Or no brand
              ],
            },
          ],
        },
      },
      {
        $project: {
          _id: 1,
          product_name: 1,
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
                                  {
                                    $ne: ["$$value.attribute_value_code", null],
                                  },
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
                  then: "$$REMOVE", // Removes `attributes_details` if empty
                  else: {
                    $cond: {
                      if: { $eq: [{ $size: "$$filteredAttributes" }, 1] },
                      then: { $arrayElemAt: ["$$filteredAttributes", 0] }, // Send as object if length = 1
                      else: "$$filteredAttributes", // Send as array if length > 1
                    },
                  },
                },
              },
            },
          },
          product_slug: 1,
          main_image: 1,
          other_images: {
            $cond: {
              if: { $eq: ["$is_variation", false] },
              then: { $arrayElemAt: ["$other_images", 0] },
              else: "$$REMOVE",
            },
          },
          main_video: 1,
          product_price: 1,
          product_discount_price: 1,
          createdAt: 1,
          updatedAt: 1,
          category: {
            _id: 1,
            category_name: 1,
            category_slug: 1,
          },
          brand: {
            _id: 1,
            brand_name: 1,
          },
          is_variation: 1,
          variations: {
            $cond: {
              if: { $eq: ["$is_variation", true] }, // Only include variations if is_variation is true
              then: { $arrayElemAt: ["$variations", 0] }, // Include only the first variation
              else: {}, // Set variations to an empty array if is_variation is false
            },
          },
          average_review_rating: 1, // Include average rating
          total_reviews: 1, // Include total reviews coun
        },
      },
      {
        $sort: {
          _id: -1,
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
    ]);
    const sendData: any = {
      findPopularProduct: findCategoryWiseProduct,
      totalCount: totalCount,
    };

    return sendData;
  }

  // Step 1: Count total data
  const totalData = await ProductModel.aggregate([
    {
      $match: {
        product_status: "active", // Filter for active products
      },
    },
    {
      $lookup: {
        from: "categories",
        localField: "category_id",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $unwind: {
        path: "$category",
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $lookup: {
        from: "subcategories",
        localField: "sub_category_id",
        foreignField: "_id",
        as: "sub_category",
      },
    },
    {
      $unwind: {
        path: "$sub_category",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "brands",
        localField: "brand_id",
        foreignField: "_id",
        as: "brand",
      },
    },
    {
      $unwind: {
        path: "$brand",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $match: {
        "category.category_status": "active",
        $and: [
          {
            $or: [
              { "sub_category.sub_category_status": "active" },
              { sub_category: null },
            ],
          },
          {
            $or: [{ "brand.brand_status": "active" }, { brand: null }],
          },
        ],
      },
    },
    {
      $count: "total",
    },
  ]);

  // Extract the total count
  const totalCount: any = totalData.length > 0 ? totalData[0].total : 0;

  const findPopularProduct = await ProductModel.aggregate([
    {
      $match: {
        product_status: "active", // Filter for active products
      },
    },
    {
      $lookup: {
        from: "categories", // Link the product's category
        localField: "category_id",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $unwind: {
        path: "$category",
        preserveNullAndEmptyArrays: false, // Only include products with a valid category
      },
    },
    {
      $lookup: {
        from: "subcategories", // Link the product's sub-category
        localField: "sub_category_id",
        foreignField: "_id",
        as: "sub_category",
      },
    },
    {
      $unwind: {
        path: "$sub_category",
        preserveNullAndEmptyArrays: true, // Include products even if sub-category details are not available
      },
    },
    {
      $lookup: {
        from: "brands", // Link the product's brand
        localField: "brand_id",
        foreignField: "_id",
        as: "brand",
      },
    },
    {
      $unwind: {
        path: "$brand",
        preserveNullAndEmptyArrays: true, // Include products even if brand details are not available
      },
    },
    {
      $lookup: {
        from: "variations", // Link the product's variations
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
              variation_quantity: "$$variation.variation_quantity",
              variation_image: "$$variation.variation_image",
              variation_video: "$$variation.variation_video",
            },
          },
        },
      },
    },
    {
      $lookup: {
        from: "reviews", // Join with reviews collection
        localField: "_id",
        foreignField: "review_product_id",
        as: "reviews",
      },
    },
    {
      $addFields: {
        average_review_rating: {
          $cond: {
            if: { $gt: [{ $size: "$reviews" }, 0] }, // Check if reviews exist
            then: {
              $divide: [
                { $sum: "$reviews.review_ratting" }, // Sum of all review ratings
                { $size: "$reviews" }, // Total number of reviews
              ],
            },
            else: 0, // Default to 0 if no reviews
          },
        },
        total_reviews: { $size: "$reviews" }, // Count of reviews
      },
    },
    {
      $match: {
        "category.category_status": "active", // Ensure the category is active
        $and: [
          {
            $or: [
              { "sub_category.sub_category_status": "active" }, // Allow active sub-category
              { sub_category: null }, // Or no sub-category
            ],
          },
          {
            $or: [
              { "brand.brand_status": "active" }, // Allow active brand
              { brand: null }, // Or no brand
            ],
          },
        ],
      },
    },
    {
      $project: {
        _id: 1,
        product_name: 1,
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
                then: "$$REMOVE", // Removes `attributes_details` if empty
                else: {
                  $cond: {
                    if: { $eq: [{ $size: "$$filteredAttributes" }, 1] },
                    then: { $arrayElemAt: ["$$filteredAttributes", 0] }, // Send as object if length = 1
                    else: "$$filteredAttributes", // Send as array if length > 1
                  },
                },
              },
            },
          },
        },
        product_slug: 1,
        main_image: 1,
        other_images: {
          $cond: {
            if: { $eq: ["$is_variation", false] },
            then: { $arrayElemAt: ["$other_images", 0] },
            else: "$$REMOVE",
          },
        },
        main_video: 1,
        product_price: 1,
        product_discount_price: 1,
        createdAt: 1,
        updatedAt: 1,
        category: {
          _id: 1,
          category_name: 1,
          category_slug: 1,
        },
        brand: {
          _id: 1,
          brand_name: 1,
        },
        is_variation: 1,
        variations: {
          $cond: {
            if: { $eq: ["$is_variation", true] }, // Only include variations if is_variation is true
            then: { $arrayElemAt: ["$variations", 0] }, // Include only the first variation
            else: {}, // Set variations to an empty array if is_variation is false
          },
        },
        average_review_rating: 1, // Include average rating
        total_reviews: 1, // Include total reviews coun
      },
    },
    {
      $sort: {
        _id: -1,
      },
    },
    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
  ]);

  const sendData: any = {
    findPopularProduct: findPopularProduct,
    totalCount: totalCount,
  };

  return sendData;
};

// export const findPopularProductServices = async (
//   category_id: any
// ): Promise<IProductInterface[] | []> => {
//   if (category_id) {
//     const findCategoryWiseProduct = await ProductModel.aggregate([
//       {
//         $match: {
//           product_status: "active", // Filter for active products
//           category_id: new Types.ObjectId(category_id),
//         },
//       },
//       {
//         $sample: { size: 10 }, // Randomly select 10 products
//       },
//       {
//         $lookup: {
//           from: "categories", // Link the product's category
//           localField: "category_id",
//           foreignField: "_id",
//           as: "category",
//         },
//       },
//       {
//         $unwind: {
//           path: "$category",
//           preserveNullAndEmptyArrays: false, // Only include products with a valid category
//         },
//       },
//       {
//         $lookup: {
//           from: "subcategories", // Link the product's sub-category
//           localField: "sub_category_id",
//           foreignField: "_id",
//           as: "sub_category",
//         },
//       },
//       {
//         $unwind: {
//           path: "$sub_category",
//           preserveNullAndEmptyArrays: true, // Include products even if sub-category details are not available
//         },
//       },
//       {
//         $lookup: {
//           from: "childcategories", // Link the product's child-category
//           localField: "child_category_id",
//           foreignField: "_id",
//           as: "child_category",
//         },
//       },
//       {
//         $unwind: {
//           path: "$child_category",
//           preserveNullAndEmptyArrays: true, // Include products even if child-category details are not available
//         },
//       },
//       {
//         $lookup: {
//           from: "brands", // Link the product's brand
//           localField: "brand_id",
//           foreignField: "_id",
//           as: "brand",
//         },
//       },
//       {
//         $unwind: {
//           path: "$brand",
//           preserveNullAndEmptyArrays: true, // Include products even if brand details are not available
//         },
//       },
//       {
//         $lookup: {
//           from: "variations", // Link the product's variations
//           localField: "_id",
//           foreignField: "product_id",
//           as: "variations",
//         },
//       },
//       {
//         $lookup: {
//           from: "reviews", // Join with reviews collection
//           localField: "_id",
//           foreignField: "review_product_id",
//           as: "reviews",
//         },
//       },
//       {
//         $addFields: {
//           average_review_rating: {
//             $cond: {
//               if: { $gt: [{ $size: "$reviews" }, 0] }, // Check if reviews exist
//               then: {
//                 $divide: [
//                   { $sum: "$reviews.review_ratting" }, // Sum of all review ratings
//                   { $size: "$reviews" }, // Total number of reviews
//                 ],
//               },
//               else: 0, // Default to 0 if no reviews
//             },
//           },
//           total_reviews: { $size: "$reviews" }, // Count of reviews
//         },
//       },
//       {
//         $addFields: {
//           variations: {
//             $map: {
//               input: "$variations",
//               as: "variation",
//               in: {
//                 _id: "$$variation._id",
//                 variation_name: "$$variation.variation_name",
//                 product_id: "$$variation.product_id",
//                 variation_price: "$$variation.variation_price",
//                 variation_discount_price:
//                   "$$variation.variation_discount_price",
//                 variation_quantity: "$$variation.variation_quantity",
//                 variation_image: "$$variation.variation_image",
//                 variation_video: "$$variation.variation_video",
//               },
//             },
//           },
//         },
//       },
//       {
//         $match: {
//           "category.category_status": "active", // Ensure the category is active
//           $and: [
//             {
//               $or: [
//                 { "sub_category.sub_category_status": "active" }, // Allow active sub-category
//                 { sub_category: null }, // Or no sub-category
//               ],
//             },
//             {
//               $or: [
//                 { "child_category.child_category_status": "active" }, // Allow active child-category
//                 { child_category: null }, // Or no child-category
//               ],
//             },
//             {
//               $or: [
//                 { "brand.brand_status": "active" }, // Allow active brand
//                 { brand: null }, // Or no brand
//               ],
//             },
//           ],
//         },
//       },
//       {
//         $lookup: {
//           from: "campaigns", // Link the product's campaign
//           localField: "product_campaign_id",
//           foreignField: "_id",
//           as: "campaign",
//         },
//       },
//       {
//         $unwind: {
//           path: "$campaign",
//           preserveNullAndEmptyArrays: true, // Include products even if campaign details are not available
//         },
//       },
//       {
//         $addFields: {
//           campaign_details: {
//             $cond: {
//               if: {
//                 $and: [
//                   { $ne: ["$campaign", null] }, // Check if campaign exists
//                   { $ne: ["$campaign.campaign_products", null] },
//                   { $eq: ["$campaign.campaign_status", "active"] }, // Check if campaign_status is active
//                   {
//                     $gt: [
//                       {
//                         $size: {
//                           $filter: {
//                             input: "$campaign.campaign_products",
//                             as: "product",
//                             cond: {
//                               $and: [
//                                 {
//                                   $eq: [
//                                     "$$product.campaign_product_id",
//                                     "$_id",
//                                   ],
//                                 }, // Match product ID
//                                 {
//                                   $eq: [
//                                     "$$product.campaign_product_status",
//                                     "active",
//                                   ],
//                                 }, // Check product status is active
//                               ],
//                             },
//                           },
//                         },
//                       },
//                       0,
//                     ],
//                   }, // Ensure at least one matching campaign product exists
//                 ],
//               },
//               then: {
//                 _id: "$campaign._id",
//                 campaign_start_date: "$campaign.campaign_start_date",
//                 campaign_end_date: "$campaign.campaign_end_date",
//                 campaign_status: "$campaign.campaign_status",
//                 campaign_product: {
//                   $arrayElemAt: [
//                     {
//                       $filter: {
//                         input: "$campaign.campaign_products",
//                         as: "product",
//                         cond: {
//                           $and: [
//                             { $eq: ["$$product.campaign_product_id", "$_id"] }, // Match product ID
//                             {
//                               $eq: [
//                                 "$$product.campaign_product_status",
//                                 "active",
//                               ],
//                             }, // Check product status is active
//                           ],
//                         },
//                       },
//                     },
//                     0,
//                   ],
//                 },
//               },
//               else: null,
//             },
//           },
//         },
//       },
//       {
//         $project: {
//           _id: 1,
//           product_name: 1,
//           attributes_details: {
//             $let: {
//               vars: {
//                 filteredAttributes: {
//                   $filter: {
//                     input: "$attributes_details",
//                     as: "attribute",
//                     cond: {
//                       $gt: [
//                         {
//                           $size: {
//                             $filter: {
//                               input: "$$attribute.attribute_values",
//                               as: "value",
//                               cond: {
//                                 $and: [
//                                   { $ne: ["$$value.attribute_value_code", null] },
//                                   { $ne: ["$$value.attribute_value_code", "undefined"] },
//                                   { $ne: ["$$value.attribute_value_code", ""] },
//                                 ],
//                               },
//                             },
//                           },
//                         },
//                         0,
//                       ],
//                     },
//                   },
//                 },
//               },
//               in: {
//                 $cond: {
//                   if: { $eq: [{ $size: "$$filteredAttributes" }, 0] },
//                   then: "$$REMOVE", // Removes `attributes_details` if empty
//                   else: {
//                     $cond: {
//                       if: { $eq: [{ $size: "$$filteredAttributes" }, 1] },
//                       then: { $arrayElemAt: ["$$filteredAttributes", 0] }, // Send as object if length = 1
//                       else: "$$filteredAttributes", // Send as array if length > 1
//                     },
//                   },
//                 },
//               },
//             },
//           },
//           product_slug: 1,
//           main_image: 1,
//           other_images: {
//             $cond: {
//               if: { $eq: ["$is_variation", false] },
//               then: { $arrayElemAt: ["$other_images", 0] },
//               else: "$$REMOVE",
//             },
//           },
//           main_video: 1,
//           product_price: 1,
//           product_discount_price: 1,
//           createdAt: 1,
//           updatedAt: 1,
//           category: {
//             _id: 1,
//             category_name: 1,
//             category_slug: 1,
//           },
//           brand: {
//             _id: 1,
//             brand_name: 1,
//           },
//           is_variation: 1,
//           variations: {
//             $cond: {
//               if: { $eq: ["$is_variation", true] }, // Only include variations if is_variation is true
//               then: { $arrayElemAt: ["$variations", 0] }, // Include only the first variation
//               else: {}, // Set variations to an empty array if is_variation is false
//             },
//           },
//           campaign_details: {
//             $cond: {
//               if: { $ne: ["$campaign_details.campaign_product", null] },
//               then: "$campaign_details",
//               else: null,
//             },
//           },
//           average_review_rating: 1, // Include average rating
//           total_reviews: 1, // Include total reviews coun
//         },
//       },
//     ]);
//     return findCategoryWiseProduct;
//   }

//   const findPopularProduct = await ProductModel.aggregate([
//     {
//       $match: {
//         product_status: "active", // Filter for active products
//       },
//     },
//     {
//       $sample: { size: 10 }, // Randomly select 10 products
//     },
//     {
//       $lookup: {
//         from: "categories", // Link the product's category
//         localField: "category_id",
//         foreignField: "_id",
//         as: "category",
//       },
//     },
//     {
//       $unwind: {
//         path: "$category",
//         preserveNullAndEmptyArrays: false, // Only include products with a valid category
//       },
//     },
//     {
//       $lookup: {
//         from: "subcategories", // Link the product's sub-category
//         localField: "sub_category_id",
//         foreignField: "_id",
//         as: "sub_category",
//       },
//     },
//     {
//       $unwind: {
//         path: "$sub_category",
//         preserveNullAndEmptyArrays: true, // Include products even if sub-category details are not available
//       },
//     },
//     {
//       $lookup: {
//         from: "childcategories", // Link the product's child-category
//         localField: "child_category_id",
//         foreignField: "_id",
//         as: "child_category",
//       },
//     },
//     {
//       $unwind: {
//         path: "$child_category",
//         preserveNullAndEmptyArrays: true, // Include products even if child-category details are not available
//       },
//     },
//     {
//       $lookup: {
//         from: "brands", // Link the product's brand
//         localField: "brand_id",
//         foreignField: "_id",
//         as: "brand",
//       },
//     },
//     {
//       $unwind: {
//         path: "$brand",
//         preserveNullAndEmptyArrays: true, // Include products even if brand details are not available
//       },
//     },
//     {
//       $lookup: {
//         from: "variations", // Link the product's variations
//         localField: "_id",
//         foreignField: "product_id",
//         as: "variations",
//       },
//     },
//     {
//       $addFields: {
//         variations: {
//           $map: {
//             input: "$variations",
//             as: "variation",
//             in: {
//               _id: "$$variation._id",
//               variation_name: "$$variation.variation_name",
//               product_id: "$$variation.product_id",
//               variation_price: "$$variation.variation_price",
//               variation_discount_price: "$$variation.variation_discount_price",
//               variation_quantity: "$$variation.variation_quantity",
//               variation_image: "$$variation.variation_image",
//               variation_video: "$$variation.variation_video",
//             },
//           },
//         },
//       },
//     },
//     {
//       $lookup: {
//         from: "reviews", // Join with reviews collection
//         localField: "_id",
//         foreignField: "review_product_id",
//         as: "reviews",
//       },
//     },
//     {
//       $addFields: {
//         average_review_rating: {
//           $cond: {
//             if: { $gt: [{ $size: "$reviews" }, 0] }, // Check if reviews exist
//             then: {
//               $divide: [
//                 { $sum: "$reviews.review_ratting" }, // Sum of all review ratings
//                 { $size: "$reviews" }, // Total number of reviews
//               ],
//             },
//             else: 0, // Default to 0 if no reviews
//           },
//         },
//         total_reviews: { $size: "$reviews" }, // Count of reviews
//       },
//     },
//     {
//       $match: {
//         "category.category_status": "active", // Ensure the category is active
//         $and: [
//           {
//             $or: [
//               { "sub_category.sub_category_status": "active" }, // Allow active sub-category
//               { sub_category: null }, // Or no sub-category
//             ],
//           },
//           {
//             $or: [
//               { "child_category.child_category_status": "active" }, // Allow active child-category
//               { child_category: null }, // Or no child-category
//             ],
//           },
//           {
//             $or: [
//               { "brand.brand_status": "active" }, // Allow active brand
//               { brand: null }, // Or no brand
//             ],
//           },
//         ],
//       },
//     },
//     {
//       $lookup: {
//         from: "campaigns", // Link the product's campaign
//         localField: "product_campaign_id",
//         foreignField: "_id",
//         as: "campaign",
//       },
//     },
//     {
//       $unwind: {
//         path: "$campaign",
//         preserveNullAndEmptyArrays: true, // Include products even if campaign details are not available
//       },
//     },
//     {
//       $addFields: {
//         campaign_details: {
//           $cond: {
//             if: {
//               $and: [
//                 { $ne: ["$campaign", null] }, // Check if campaign exists
//                 { $ne: ["$campaign.campaign_products", null] },
//                 { $eq: ["$campaign.campaign_status", "active"] }, // Check if campaign_status is active
//                 {
//                   $gt: [
//                     {
//                       $size: {
//                         $filter: {
//                           input: "$campaign.campaign_products",
//                           as: "product",
//                           cond: {
//                             $and: [
//                               {
//                                 $eq: ["$$product.campaign_product_id", "$_id"],
//                               }, // Match product ID
//                               {
//                                 $eq: [
//                                   "$$product.campaign_product_status",
//                                   "active",
//                                 ],
//                               }, // Check product status is active
//                             ],
//                           },
//                         },
//                       },
//                     },
//                     0,
//                   ],
//                 }, // Ensure at least one matching campaign product exists
//               ],
//             },
//             then: {
//               _id: "$campaign._id",
//               campaign_start_date: "$campaign.campaign_start_date",
//               campaign_end_date: "$campaign.campaign_end_date",
//               campaign_status: "$campaign.campaign_status",
//               campaign_product: {
//                 $arrayElemAt: [
//                   {
//                     $filter: {
//                       input: "$campaign.campaign_products",
//                       as: "product",
//                       cond: {
//                         $and: [
//                           { $eq: ["$$product.campaign_product_id", "$_id"] }, // Match product ID
//                           {
//                             $eq: [
//                               "$$product.campaign_product_status",
//                               "active",
//                             ],
//                           }, // Check product status is active
//                         ],
//                       },
//                     },
//                   },
//                   0,
//                 ],
//               },
//             },
//             else: null,
//           },
//         },
//       },
//     },
//     {
//       $project: {
//         _id: 1,
//         product_name: 1,
//         attributes_details: {
//           $let: {
//             vars: {
//               filteredAttributes: {
//                 $filter: {
//                   input: "$attributes_details",
//                   as: "attribute",
//                   cond: {
//                     $gt: [
//                       {
//                         $size: {
//                           $filter: {
//                             input: "$$attribute.attribute_values",
//                             as: "value",
//                             cond: {
//                               $and: [
//                                 { $ne: ["$$value.attribute_value_code", null] },
//                                 { $ne: ["$$value.attribute_value_code", "undefined"] },
//                                 { $ne: ["$$value.attribute_value_code", ""] },
//                               ],
//                             },
//                           },
//                         },
//                       },
//                       0,
//                     ],
//                   },
//                 },
//               },
//             },
//             in: {
//               $cond: {
//                 if: { $eq: [{ $size: "$$filteredAttributes" }, 0] },
//                 then: "$$REMOVE", // Removes `attributes_details` if empty
//                 else: {
//                   $cond: {
//                     if: { $eq: [{ $size: "$$filteredAttributes" }, 1] },
//                     then: { $arrayElemAt: ["$$filteredAttributes", 0] }, // Send as object if length = 1
//                     else: "$$filteredAttributes", // Send as array if length > 1
//                   },
//                 },
//               },
//             },
//           },
//         },
//         product_slug: 1,
//         main_image: 1,
//         other_images: {
//           $cond: {
//             if: { $eq: ["$is_variation", false] },
//             then: { $arrayElemAt: ["$other_images", 0] },
//             else: "$$REMOVE",
//           },
//         },
//         main_video: 1,
//         product_price: 1,
//         product_discount_price: 1,
//         createdAt: 1,
//         updatedAt: 1,
//         category: {
//           _id: 1,
//           category_name: 1,
//           category_slug: 1,
//         },
//         brand: {
//           _id: 1,
//           brand_name: 1,
//         },
//         is_variation: 1,
//         variations: {
//           $cond: {
//             if: { $eq: ["$is_variation", true] }, // Only include variations if is_variation is true
//             then: { $arrayElemAt: ["$variations", 0] }, // Include only the first variation
//             else: {}, // Set variations to an empty array if is_variation is false
//           },
//         },
//         campaign_details: {
//           $cond: {
//             if: { $ne: ["$campaign_details.campaign_product", null] },
//             then: "$campaign_details",
//             else: null,
//           },
//         },
//         average_review_rating: 1, // Include average rating
//         total_reviews: 1, // Include total reviews coun
//       },
//     },
//   ]);

//   return findPopularProduct;
// };

// Find ECommerceChoiceProduct
export const findECommerceChoiceProductServices = async (
  limit: number,
  skip: number,
): Promise<IProductInterface[] | [] | any> => {
  // Step 1: Count total data
  const totalData = await ProductModel.aggregate([
    {
      $match: {
        product_status: "active", // Filter for active products
      },
    },
    {
      $lookup: {
        from: "categories",
        localField: "category_id",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $unwind: {
        path: "$category",
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $lookup: {
        from: "subcategories",
        localField: "sub_category_id",
        foreignField: "_id",
        as: "sub_category",
      },
    },
    {
      $unwind: {
        path: "$sub_category",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "childcategories",
        localField: "child_category_id",
        foreignField: "_id",
        as: "child_category",
      },
    },
    {
      $unwind: {
        path: "$child_category",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "brands",
        localField: "brand_id",
        foreignField: "_id",
        as: "brand",
      },
    },
    {
      $unwind: {
        path: "$brand",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $match: {
        "category.category_status": "active",
        $and: [
          {
            $or: [
              { "sub_category.sub_category_status": "active" },
              { sub_category: null },
            ],
          },
          {
            $or: [
              { "child_category.child_category_status": "active" },
              { child_category: null },
            ],
          },
          {
            $or: [{ "brand.brand_status": "active" }, { brand: null }],
          },
        ],
      },
    },
    {
      $count: "total",
    },
  ]);

  // Extract the total count
  const totalCount: any = totalData.length > 0 ? totalData[0].total : 0;

  const findECommerceChoiceProduct = await ProductModel.aggregate([
    {
      $match: {
        product_status: "active", // Filter for active products
      },
    },
    // {
    //   $sample: { size: 10 }, // Randomly select 10 products
    // },
    {
      $lookup: {
        from: "categories", // Link the product's category
        localField: "category_id",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $unwind: {
        path: "$category",
        preserveNullAndEmptyArrays: false, // Only include products with a valid category
      },
    },
    {
      $lookup: {
        from: "subcategories", // Link the product's sub-category
        localField: "sub_category_id",
        foreignField: "_id",
        as: "sub_category",
      },
    },
    {
      $unwind: {
        path: "$sub_category",
        preserveNullAndEmptyArrays: true, // Include products even if sub-category details are not available
      },
    },
    {
      $lookup: {
        from: "childcategories", // Link the product's child-category
        localField: "child_category_id",
        foreignField: "_id",
        as: "child_category",
      },
    },
    {
      $unwind: {
        path: "$child_category",
        preserveNullAndEmptyArrays: true, // Include products even if child-category details are not available
      },
    },
    {
      $lookup: {
        from: "brands", // Link the product's brand
        localField: "brand_id",
        foreignField: "_id",
        as: "brand",
      },
    },
    {
      $unwind: {
        path: "$brand",
        preserveNullAndEmptyArrays: true, // Include products even if brand details are not available
      },
    },
    {
      $lookup: {
        from: "variations", // Link the product's variations
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
              variation_quantity: "$$variation.variation_quantity",
              variation_image: "$$variation.variation_image",
            },
          },
        },
      },
    },
    {
      $lookup: {
        from: "reviews", // Join with reviews collection
        localField: "_id",
        foreignField: "review_product_id",
        as: "reviews",
      },
    },
    {
      $addFields: {
        average_review_rating: {
          $cond: {
            if: { $gt: [{ $size: "$reviews" }, 0] }, // Check if reviews exist
            then: {
              $divide: [
                { $sum: "$reviews.review_ratting" }, // Sum of all review ratings
                { $size: "$reviews" }, // Total number of reviews
              ],
            },
            else: 0, // Default to 0 if no reviews
          },
        },
        total_reviews: { $size: "$reviews" }, // Count of reviews
      },
    },
    {
      $match: {
        "category.category_status": "active", // Ensure the category is active
        $and: [
          {
            $or: [
              { "sub_category.sub_category_status": "active" }, // Allow active sub-category
              { sub_category: null }, // Or no sub-category
            ],
          },
          {
            $or: [
              { "child_category.child_category_status": "active" }, // Allow active child-category
              { child_category: null }, // Or no child-category
            ],
          },
          {
            $or: [
              { "brand.brand_status": "active" }, // Allow active brand
              { brand: null }, // Or no brand
            ],
          },
        ],
      },
    },
    {
      $lookup: {
        from: "campaigns", // Link the product's campaign
        localField: "product_campaign_id",
        foreignField: "_id",
        as: "campaign",
      },
    },
    {
      $unwind: {
        path: "$campaign",
        preserveNullAndEmptyArrays: true, // Include products even if campaign details are not available
      },
    },
    {
      $addFields: {
        campaign_details: {
          $cond: {
            if: {
              $and: [
                { $ne: ["$campaign", null] }, // Check if campaign exists
                { $ne: ["$campaign.campaign_products", null] },
                { $eq: ["$campaign.campaign_status", "active"] }, // Check if campaign_status is active
                {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: "$campaign.campaign_products",
                          as: "product",
                          cond: {
                            $and: [
                              {
                                $eq: ["$$product.campaign_product_id", "$_id"],
                              }, // Match product ID
                              {
                                $eq: [
                                  "$$product.campaign_product_status",
                                  "active",
                                ],
                              }, // Check product status is active
                            ],
                          },
                        },
                      },
                    },
                    0,
                  ],
                }, // Ensure at least one matching campaign product exists
              ],
            },
            then: {
              _id: "$campaign._id",
              campaign_start_date: "$campaign.campaign_start_date",
              campaign_end_date: "$campaign.campaign_end_date",
              campaign_status: "$campaign.campaign_status",
              campaign_product: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$campaign.campaign_products",
                      as: "product",
                      cond: {
                        $and: [
                          { $eq: ["$$product.campaign_product_id", "$_id"] }, // Match product ID
                          {
                            $eq: [
                              "$$product.campaign_product_status",
                              "active",
                            ],
                          }, // Check product status is active
                        ],
                      },
                    },
                  },
                  0,
                ],
              },
            },
            else: null,
          },
        },
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
        brand: {
          _id: 1,
          brand_name: 1,
        },
        category: {
          _id: 1,
          category_name: 1,
          category_slug: 1,
        },
        is_variation: 1,
        variations: {
          $cond: {
            if: { $eq: ["$is_variation", true] }, // Only include variations if is_variation is true
            then: { $arrayElemAt: ["$variations", 0] }, // Include only the first variation
            else: {}, // Set variations to an empty array if is_variation is false
          },
        },
        campaign_details: {
          $cond: {
            if: { $ne: ["$campaign_details.campaign_product", null] },
            then: "$campaign_details",
            else: null,
          },
        },
        average_review_rating: 1, // Include average rating
        total_reviews: 1, // Include total reviews coun
      },
    },
    {
      $sort: {
        _id: -1, // Sort by createdAt field in descending order
      },
    },
    {
      $skip: skip, // Skip the number of documents
    },
    {
      $limit: limit, // Limit the number of documents
    },
  ]);

  // Return both the data and total count
  return {
    data: findECommerceChoiceProduct,
    totalData: totalCount,
  };
};

// Find JustForYouProduct
export const findJustForYouProductServices = async (): Promise<
  IProductInterface[] | [] | any
> => {
  const exploreCategory: any = await CategoryModel.find({
    explore_category_show: true,
    category_status: "active",
  });

  const matchedProductsByCategory = await Promise.all(
    exploreCategory?.map(async (category: any) => {
      const findJustForYouProduct: any = await ProductModel.aggregate([
        {
          $match: {
            product_status: "active", // Filter for active products
            category_id: category?._id, // Filter by category ID
          },
        },
        {
          $lookup: {
            from: "subcategories", // Link the product's sub-category
            localField: "sub_category_id",
            foreignField: "_id",
            as: "sub_category",
          },
        },
        {
          $unwind: {
            path: "$sub_category",
            preserveNullAndEmptyArrays: true, // Include products even if sub-category details are not available
          },
        },
        {
          $lookup: {
            from: "childcategories", // Link the product's child-category
            localField: "child_category_id",
            foreignField: "_id",
            as: "child_category",
          },
        },
        {
          $unwind: {
            path: "$child_category",
            preserveNullAndEmptyArrays: true, // Include products even if child-category details are not available
          },
        },
        {
          $lookup: {
            from: "brands", // Link the product's brand
            localField: "brand_id",
            foreignField: "_id",
            as: "brand",
          },
        },
        {
          $unwind: {
            path: "$brand",
            preserveNullAndEmptyArrays: true, // Include products even if brand details are not available
          },
        },
        {
          $lookup: {
            from: "variations", // Link the product's variations
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
                  variation_discount_price:
                    "$$variation.variation_discount_price",
                  variation_quantity: "$$variation.variation_quantity",
                  variation_image: "$$variation.variation_image",
                  variation_video: "$$variation.variation_video",
                },
              },
            },
          },
        },
        {
          $lookup: {
            from: "reviews", // Join with reviews collection
            localField: "_id",
            foreignField: "review_product_id",
            as: "reviews",
          },
        },
        {
          $addFields: {
            average_review_rating: {
              $cond: {
                if: { $gt: [{ $size: "$reviews" }, 0] }, // Check if reviews exist
                then: {
                  $divide: [
                    { $sum: "$reviews.review_ratting" }, // Sum of all review ratings
                    { $size: "$reviews" }, // Total number of reviews
                  ],
                },
                else: 0, // Default to 0 if no reviews
              },
            },
            total_reviews: { $size: "$reviews" }, // Count of reviews
          },
        },
        {
          $match: {
            $and: [
              {
                $or: [
                  { "sub_category.sub_category_status": "active" }, // Allow active sub-category
                  { sub_category: null }, // Or no sub-category
                ],
              },
              {
                $or: [
                  { "child_category.child_category_status": "active" }, // Allow active child-category
                  { child_category: null }, // Or no child-category
                ],
              },
              {
                $or: [
                  { "brand.brand_status": "active" }, // Allow active brand
                  { brand: null }, // Or no brand
                ],
              },
            ],
          },
        },
        {
          $lookup: {
            from: "campaigns", // Link the product's campaign
            localField: "product_campaign_id",
            foreignField: "_id",
            as: "campaign",
          },
        },
        {
          $unwind: {
            path: "$campaign",
            preserveNullAndEmptyArrays: true, // Include products even if campaign details are not available
          },
        },
        {
          $addFields: {
            campaign_details: {
              $cond: {
                if: {
                  $and: [
                    { $ne: ["$campaign", null] }, // Check if campaign exists
                    { $ne: ["$campaign.campaign_products", null] },
                    { $eq: ["$campaign.campaign_status", "active"] }, // Check if campaign_status is active
                    {
                      $gt: [
                        {
                          $size: {
                            $filter: {
                              input: "$campaign.campaign_products",
                              as: "product",
                              cond: {
                                $and: [
                                  {
                                    $eq: [
                                      "$$product.campaign_product_id",
                                      "$_id",
                                    ],
                                  }, // Match product ID
                                  {
                                    $eq: [
                                      "$$product.campaign_product_status",
                                      "active",
                                    ],
                                  }, // Check product status is active
                                ],
                              },
                            },
                          },
                        },
                        0,
                      ],
                    }, // Ensure at least one matching campaign product exists
                  ],
                },
                then: {
                  _id: "$campaign._id",
                  campaign_start_date: "$campaign.campaign_start_date",
                  campaign_end_date: "$campaign.campaign_end_date",
                  campaign_status: "$campaign.campaign_status",
                  campaign_product: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$campaign.campaign_products",
                          as: "product",
                          cond: {
                            $and: [
                              {
                                $eq: ["$$product.campaign_product_id", "$_id"],
                              }, // Match product ID
                              {
                                $eq: [
                                  "$$product.campaign_product_status",
                                  "active",
                                ],
                              }, // Check product status is active
                            ],
                          },
                        },
                      },
                      0,
                    ],
                  },
                },
                else: null,
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            product_name: 1,
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
                                    {
                                      $ne: [
                                        "$$value.attribute_value_code",
                                        null,
                                      ],
                                    },
                                    {
                                      $ne: [
                                        "$$value.attribute_value_code",
                                        "undefined",
                                      ],
                                    },
                                    {
                                      $ne: ["$$value.attribute_value_code", ""],
                                    },
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
                    then: "$$REMOVE", // Removes `attributes_details` if empty
                    else: {
                      $cond: {
                        if: { $eq: [{ $size: "$$filteredAttributes" }, 1] },
                        then: { $arrayElemAt: ["$$filteredAttributes", 0] }, // Send as object if length = 1
                        else: "$$filteredAttributes", // Send as array if length > 1
                      },
                    },
                  },
                },
              },
            },
            product_slug: 1,
            main_image: 1,
            other_images: {
              $cond: {
                if: { $eq: ["$is_variation", false] },
                then: { $arrayElemAt: ["$other_images", 0] },
                else: "$$REMOVE",
              },
            },
            main_video: 1,
            product_price: 1,
            product_discount_price: 1,
            createdAt: 1,
            updatedAt: 1,
            brand: {
              _id: 1,
              brand_name: 1,
            },
            is_variation: 1,
            variations: {
              $cond: {
                if: { $eq: ["$is_variation", true] }, // Only include variations if is_variation is true
                then: { $arrayElemAt: ["$variations", 0] }, // Include only the first variation
                else: {}, // Set variations to an empty array if is_variation is false
              },
            },
            campaign_details: {
              $cond: {
                if: { $ne: ["$campaign_details.campaign_product", null] },
                then: "$campaign_details",
                else: null,
              },
            },
            average_review_rating: 1, // Include average rating
            total_reviews: 1, // Include total reviews coun
          },
        },
        {
          $sort: {
            _id: -1, // Sort by createdAt in descending order
          },
        },
        {
          $skip: 0, // Skip the number of documents
        },
        {
          $limit: 20, // Limit the number of documents
        },
      ]);
      // ✅ Exclude if no products
      if (findJustForYouProduct.length > 0) {
        return { categoryDetails: category, products: findJustForYouProduct };
      }
      return null;
    }),
  );

  // ✅ Filter out null entries
  return matchedProductsByCategory.filter((entry) => entry !== null);
};

// update A Product
export const updateProductServices = async (
  _id: any,
  data: IProductInterface,
): Promise<IProductInterface | {}> => {
  const updateFindProduct: IProductInterface | {} | any =
    await ProductModel.findOne({
      _id,
    });
  if (!updateFindProduct) {
    throw new Error("Product not found");
  }
  // আপডেট করার ডেটা তৈরি করা হচ্ছে
  const updateData: any = { ...data };

  // যদি `sub_category_id` পাঠানো না হয়, তাহলে সেটি ডিলিট করা হবে
  const unsetData: any = {};
  if (!data.hasOwnProperty("sub_category_id")) {
    unsetData.sub_category_id = "";
  }
  if (!data.hasOwnProperty("child_category_id")) {
    unsetData.child_category_id = "";
  }
  if (!data.hasOwnProperty("brand_id")) {
    unsetData.brand_id = "";
  }

  const updateProduct = await ProductModel.updateOne(
    { _id: _id },
    {
      $set: updateData, // পাঠানো ফিল্ড আপডেট করা
      $unset: unsetData, // পাঠানো না হলে ফিল্ডগুলো মুছে ফেলা
    },
    { runValidators: true },
  );

  return updateProduct;
};

// Find all dashboard Product
export const findAllDashboardProductServices = async (
  limit: number,
  skip: number,
  searchTerm: any,
): Promise<any> => {
  const andCondition = [];
  if (searchTerm) {
    andCondition.push({
      $or: productSearchableField.map((field) => ({
        [field]: {
          $regex: searchTerm,
          $options: "i",
        },
      })),
    });
  }

  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};

  // Step 1: Find products with basic population
  const products = await ProductModel.find(whereCondition)
    .populate([
      { path: "product_supplier_id" },
      { path: "category_id" },
      { path: "sub_category_id" },
      { path: "child_category_id" },
      { path: "brand_id" },
      { path: "product_publisher_id" },
      { path: "product_updated_by" },
      { path: "specifications.specification_id", model: "specifications" },
    ])
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .select("-__v")
    .lean(); // Return plain JavaScript objects for easier processing

  // Step 2: For each product, conditionally fetch variations if is_variation is true
  const productsWithVariations = await Promise.all(
    products.map(async (product) => {
      // Only fetch variations if is_variation is true
      if (product?.is_variation) {
        const variations = await VariationModel.find({
          product_id: product?._id,
        })
          .select("-__v")
          .lean();

        // Add variations to the product object
        return { ...product, variations };
      } else {
        // Return the product as is without variations
        return { ...product, variations: [] };
      }
    }),
  );

  return productsWithVariations;
};

// Find a dashboard Product
export const findADashboardProductServices = async (
  _id: string,
): Promise<any | null> => {
  // Step 1: Find the product by its ID and populate related fields
  const findProduct = await ProductModel.findOne({ _id })
    .populate([
      { path: "category_id" },
      { path: "sub_category_id" },
      { path: "child_category_id" },
      { path: "brand_id" },
      { path: "product_publisher_id" },
      { path: "product_updated_by" },
      {
        path: "specifications.specification_id",
        model: "attributes",
      },
    ])
    .select("-__v")
    .lean(); // Use .lean() to return a plain JavaScript object

  if (!findProduct) {
    throw new ApiError(404, "Product Not Found !");
  }
  if (findProduct?.is_variation) {
    // Step 2: Find variations related to the product and populate attributes
    const variations = await VariationModel.find({ product_id: _id })
      .select("-__v")
      .lean();

    // Step 3: Combine product data with variations
    return { ...findProduct, variations };
  }
  return { ...findProduct };
};

// Delete a Product
export const deleteProductServices = async (
  _id: string,
): Promise<IProductInterface | any> => {
  const updateProductInfo: IProductInterface | null =
    await ProductModel.findOne({ _id: _id });
  if (!updateProductInfo) {
    throw new ApiError(404, "Product not found");
  }
  const Product = await ProductModel.deleteOne(
    { _id: _id },
    {
      runValidators: true,
    },
  );
  return Product;
};
