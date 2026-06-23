import mongoose, { Types } from "mongoose";
import ApiError from "../../errors/ApiError";
import VariationModel from "../variation/variation.model";
import { IProductInterface, productSearchableField } from "./product.interface";
import ProductModel from "./product.model";
import ProductCountHistoryModel from "./productCountHistory.model";
import OrderProductModel from "../orderProducts/orderProduct.model";
import ReviewModel from "../review/review.model";
import CategoryModel from "../category/category.model";
import BrandModel from "../brand/brand.model";
import {
  findActiveFlashForProduct,
  findActiveFlashWithMetaForProduct,
  findActiveFlashMapForProducts,
} from "../flashsale/flashsale.services";
import CampaignModel from "../campaign/campaign.model";
import { FileUploadHelper } from "../../helpers/image.upload";

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
        { path: "brand_id", model: "brands" },
        { path: "theme_id", model: "themes" },
        // Resolve structured attribute payload so the PDP can render the spec
        // table without separate look-ups. attribute_id → full attribute doc;
        // FE then filters attribute_values by the chosen value_ids.
        { path: "product_attributes.attribute_id", model: "attributes" },
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
    findProduct?.brand_id &&
    findProduct?.brand_id?.brand_status !== "active"
  ) {
    throw new ApiError(404, "Product Unavailable !");
  }

  const targetProductId = findProduct?._id;

  // Step 3: Campaign lookup — PDP needs campaign_details same shape as strips.
  // product_campaign_id is a raw ObjectId ref (not populated above), so we
  // query CampaignModel directly. Best-effort: never block PDP on it.
  try {
    if (findProduct?.product_campaign_id) {
      const campaign: any = await CampaignModel.findOne({
        _id: findProduct.product_campaign_id,
        campaign_status: "active",
      })
        .select("_id campaign_title campaign_start_date campaign_end_date campaign_status campaign_products")
        .lean();

      if (campaign) {
        const campaignProduct = campaign.campaign_products?.find(
          (p: any) =>
            String(p?.campaign_product_id) === String(targetProductId) &&
            p?.campaign_product_status === "active",
        );
        if (campaignProduct) {
          findProduct.campaign_details = {
            _id: campaign._id,
            campaign_title: campaign.campaign_title,
            campaign_start_date: campaign.campaign_start_date,
            campaign_end_date: campaign.campaign_end_date,
            campaign_status: campaign.campaign_status,
            campaign_product: campaignProduct,
          };
        }
      }
    }
  } catch (_) {
    // Campaign lookup best-effort — never block PDP.
  }

  // Step 3: Check if the product has variations
  if (findProduct?.is_variation) {
    const variations = await VariationModel.find({
      product_id: targetProductId,
    })
      .select(
        // variation_sku is INCLUDED — surfaced on PDP for buyer reference.
        // variation_barcode + image stay EXCLUDED (warehouse-only artifacts).
        "-__v -variation_buying_price -variation_alert_quantity -variation_barcode -variation_barcode_image -variation_barcode_image_key -variation_image_key -createdAt -updatedAt",
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

  if (findProduct?.brand_id) {
    findProduct.brand_id = {
      _id: findProduct?.brand_id?._id,
      brand_name: findProduct?.brand_id?.brand_name,
    };
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

  // Phase E (F2) — attach the active flash sale row for this product so the
  // PDP can render the countdown + flash price without a second round-trip.
  // Returns null if nothing's active right now; FE renders normal price.
  // Dual-write: active_flash (new PdpPriceMeta shape) + flash_sale_details
  // (legacy FE shape used by helper.js, SingleProduct, ProductHighlightSection).
  try {
    const flashMeta = await findActiveFlashWithMetaForProduct(targetProductId);
    if (flashMeta) {
      findProduct.active_flash = flashMeta;
      findProduct.flash_sale_details = {
        flash_sale_product: {
          flash_sale_product_price: flashMeta.product_entry.flash_price,
          flash_price_type: flashMeta.product_entry.flash_price_type,
          flash_sale_title: flashMeta.title,
          flash_sale_end_time: flashMeta.end_at,
        },
      };
    }
  } catch (_) {
    // Flash lookup is best-effort; never block PDP load on it.
  }

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
      { path: "category_id", model: "categories" },
    ])
    .select(
      "-__v -barcode -barcode_image -product_publisher_id -product_by -product_supplier_id -product_buying_price -product_alert_quantity -createdAt -updatedAt -category_id -category_path -product_sku -description -other_images -main_image_key -meta_title -meta_description -meta_keywords -attributes_details",
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

  // ── Step 3.5: একটাই query তে সব active campaign ───────────
  // F1.1 fix — cart must carry campaign_details so (a) the cart UI shows the
  // campaign price and (b) AddToCart sends a real campaign_id to checkout
  // (was always null → campaign discount silently lost). Batched ($in) to
  // avoid N+1 on large carts. Same campaign_details shape as the PDP/strip
  // path so FE helper.js productPrice() campaign branch reads it unchanged.
  // NOTE: flash is intentionally NOT enriched here yet — flash "fixed"/percent
  // base semantics differ FE↔BE (resolver.ts vs helper.js) and aligning them
  // touches the core price resolver; tracked separately. Flash stays a known
  // "regular shown / flash charged" (under-charge, buyer-favourable) gap.
  const campaignIds = [
    ...new Set(
      foundProducts
        .filter((p) => p.product_campaign_id)
        .map((p) => p.product_campaign_id.toString()),
    ),
  ].map((id) => new Types.ObjectId(id as string));

  const campaignByProductId = new Map<string, any>();
  // Best-effort — never crash the cart on a campaign lookup hiccup (mirrors the
  // PDP path's try/catch). On failure the cart just falls back to base price.
  try {
    if (campaignIds.length) {
      const activeCampaigns: any[] = await CampaignModel.find({
        _id: { $in: campaignIds },
        campaign_status: "active",
      })
        .select(
          "_id campaign_title campaign_start_date campaign_end_date campaign_status campaign_products",
        )
        .lean();

      for (const product of foundProducts) {
        if (!product.product_campaign_id) continue;
        const campaign = activeCampaigns.find(
          (c) =>
            c._id.toString() === product.product_campaign_id.toString(),
        );
        if (!campaign) continue;
        const campaignProduct = campaign.campaign_products?.find(
          (cp: any) =>
            String(cp?.campaign_product_id) === String(product._id) &&
            cp?.campaign_product_status === "active",
        );
        if (!campaignProduct) continue;
        campaignByProductId.set(product._id.toString(), {
          _id: campaign._id,
          campaign_title: campaign.campaign_title,
          campaign_start_date: campaign.campaign_start_date,
          campaign_end_date: campaign.campaign_end_date,
          campaign_status: campaign.campaign_status,
          campaign_product: campaignProduct,
        });
      }
    }
  } catch (_) {
    // campaign enrichment is best-effort — never block the cart on it.
  }

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
      baseProduct?.brand_id &&
      baseProduct?.brand_id?.brand_status !== "active"
    )
      continue;

    // ✅ deep copy — same product এর দুটো variation আলাদা object হবে
    const findProduct: any = { ...baseProduct };

    // category cleanup
    delete findProduct.category_id;

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

    // campaign attach (F1.1) — after the deep-copy so each cart line owns its
    // own campaign_details; productPrice() (FE) then enters the campaign branch
    // and AddToCart sends campaign_details._id as a real campaign_id.
    const campaignDetails = campaignByProductId.get(productIdStr);
    if (campaignDetails) {
      findProduct.campaign_details = campaignDetails;
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
      ])
      .select(
        "product_name product_slug category_id brand_id main_image unit product_warrenty product_return",
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
        from: "reviews",
        localField: "_id",
        foreignField: "review_product_id",
        as: "reviews",
        pipeline: [{ $match: { review_status: "active" } }],
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
        $or: [{ "brand.brand_status": "active" }, { brand: null }],
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
        from: "reviews",
        localField: "_id",
        foreignField: "review_product_id",
        as: "reviews",
        pipeline: [{ $match: { review_status: "active" } }],
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
        $or: [
          { "brand.brand_status": "active" }, // Allow active brand
          { brand: null }, // Or no brand
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
        // Page-content fields — needed by the boutique home (product_features /
        // hero_spotlight) to render rich feature rows. Default sliders/cards
        // ignore the extra fields; only the payload grows slightly. See
        // .claude/work/boutique-home/PLAN.md H4.
        short_description: 1,
        badge_text: 1,
        benefits: 1,
        use_cases: 1,
        nutrition: 1,
        // Full image list for the boutique home carousel (works for variation
        // products too, where `other_images` above is REMOVED). Other consumers
        // ignore this; the existing `other_images` field is untouched.
        gallery_images: { $ifNull: ["$other_images", []] },
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
        // Boutique home (product_features) needs the FULL variation list — each
        // pack-size as a clickable chip that swaps image/video + price. Separate
        // field so the existing first-only `variations` (ProductCard relies on
        // it) is untouched. Empty array for simple products; other consumers
        // simply ignore this field.
        variation_options: {
          $cond: {
            if: { $eq: ["$is_variation", true] },
            then: {
              $map: {
                input: "$variations",
                as: "v",
                in: {
                  _id: "$$v._id",
                  variation_name: "$$v.variation_name",
                  variation_price: "$$v.variation_price",
                  variation_discount_price: "$$v.variation_discount_price",
                  variation_quantity: "$$v.variation_quantity",
                  variation_image: "$$v.variation_image",
                  variation_video: "$$v.variation_video",
                  combination: "$$v.combination",
                },
              },
            },
            else: [],
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

  const flashMap = await findActiveFlashMapForProducts(findTrendingProduct.map((p: any) => p._id));
  const enrichedTrending = findTrendingProduct.map((p: any) => {
    const flash = flashMap.get(String(p._id));
    return flash ? { ...p, flash_sale_details: { flash_sale_product: flash } } : p;
  });

  // Return both the data and total count
  return {
    data: enrichedTrending,
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
      $match: {
        "category.category_status": "active",
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
        from: "reviews",
        localField: "_id",
        foreignField: "review_product_id",
        as: "reviews",
        pipeline: [{ $match: { review_status: "active" } }],
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
        // Page-content fields — needed by the boutique home (product_features /
        // hero_spotlight) to render rich feature rows. Default sliders/cards
        // ignore the extra fields; only the payload grows slightly. See
        // .claude/work/boutique-home/PLAN.md H4.
        short_description: 1,
        badge_text: 1,
        benefits: 1,
        use_cases: 1,
        nutrition: 1,
        // Full image list for the boutique home carousel (works for variation
        // products too, where `other_images` above is REMOVED). Other consumers
        // ignore this; the existing `other_images` field is untouched.
        gallery_images: { $ifNull: ["$other_images", []] },
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
        // Boutique home (product_features) needs the FULL variation list — each
        // pack-size as a clickable chip that swaps image/video + price. Separate
        // field so the existing first-only `variations` (ProductCard relies on
        // it) is untouched. Empty array for simple products; other consumers
        // simply ignore this field.
        variation_options: {
          $cond: {
            if: { $eq: ["$is_variation", true] },
            then: {
              $map: {
                input: "$variations",
                as: "v",
                in: {
                  _id: "$$v._id",
                  variation_name: "$$v.variation_name",
                  variation_price: "$$v.variation_price",
                  variation_discount_price: "$$v.variation_discount_price",
                  variation_quantity: "$$v.variation_quantity",
                  variation_image: "$$v.variation_image",
                  variation_video: "$$v.variation_video",
                  combination: "$$v.combination",
                },
              },
            },
            else: [],
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
          $or: [{ "brand.brand_status": "active" }, { brand: null }],
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
          $or: [
            { "brand.brand_status": "active" }, // Allow active brand
            { brand: null }, // Or no brand
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
        $or: [{ "brand.brand_status": "active" }, { brand: null }],
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
        from: "reviews",
        localField: "_id",
        foreignField: "review_product_id",
        as: "reviews",
        pipeline: [{ $match: { review_status: "active" } }],
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
        $or: [
          { "brand.brand_status": "active" }, // Allow active brand
          { brand: null }, // Or no brand
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

// ─── Top Selling (সবচেয়ে বেশি বিক্রি) ──────────────────────────────────────
// Sorts by sold_count desc — admin seeds a baseline; real orders accumulate.
// category_id: optional filter for category-wise popular products strip.
export const findTopSellingProductServices = async (
  limit: number,
  skip: number,
  category_id?: any,
): Promise<any> => {
  const baseMatch: any = { product_status: "active" };
  if (category_id) baseMatch.category_id = new Types.ObjectId(category_id);
  const categoryBrandFilters = [
    { $lookup: { from: "categories", localField: "category_id", foreignField: "_id", as: "category" } },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: false } },
    { $lookup: { from: "brands", localField: "brand_id", foreignField: "_id", as: "brand" } },
    { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },
    { $match: { "category.category_status": "active", $or: [{ "brand.brand_status": "active" }, { brand: null }] } },
  ];

  const totalData = await ProductModel.aggregate([
    { $match: baseMatch },
    ...categoryBrandFilters,
    { $count: "total" },
  ]);
  const totalCount = totalData.length > 0 ? totalData[0].total : 0;

  const products = await ProductModel.aggregate([
    { $match: baseMatch },
    ...categoryBrandFilters,
    { $lookup: { from: "variations", localField: "_id", foreignField: "product_id", as: "variations" } },
    {
      $addFields: {
        variations: {
          $map: {
            input: "$variations", as: "v",
            in: { _id: "$$v._id", variation_name: "$$v.variation_name", product_id: "$$v.product_id", variation_price: "$$v.variation_price", variation_discount_price: "$$v.variation_discount_price", variation_quantity: "$$v.variation_quantity", variation_image: "$$v.variation_image", variation_video: "$$v.variation_video" },
          },
        },
      },
    },
    {
      $lookup: {
        from: "reviews", localField: "_id", foreignField: "review_product_id", as: "reviews",
        pipeline: [{ $match: { review_status: "active" } }],
      },
    },
    {
      $addFields: {
        average_review_rating: { $cond: { if: { $gt: [{ $size: "$reviews" }, 0] }, then: { $divide: [{ $sum: "$reviews.review_ratting" }, { $size: "$reviews" }] }, else: 0 } },
        total_reviews: { $size: "$reviews" },
      },
    },
    { $project: { _id: 1, product_name: 1, product_slug: 1, main_image: 1, other_images: { $cond: { if: { $eq: ["$is_variation", false] }, then: { $arrayElemAt: ["$other_images", 0] }, else: "$$REMOVE" } }, main_video: 1, product_price: 1, product_discount_price: 1, sold_count: 1, createdAt: 1, updatedAt: 1, category: { _id: 1, category_name: 1, category_slug: 1 }, brand: { _id: 1, brand_name: 1 }, is_variation: 1, variations: { $cond: { if: { $eq: ["$is_variation", true] }, then: { $arrayElemAt: ["$variations", 0] }, else: {} } }, attributes_details: 1, average_review_rating: 1, total_reviews: 1 } },
    { $sort: { sold_count: -1, _id: -1 } },
    { $skip: skip },
    { $limit: limit },
  ]);

  const flashMap = await findActiveFlashMapForProducts(products.map((p: any) => p._id));
  const enriched = products.map((p: any) => {
    const flash = flashMap.get(String(p._id));
    return flash ? { ...p, flash_sale_details: { flash_sale_product: flash } } : p;
  });

  return { data: enriched, totalCount };
};

// ─── New Arrival (নতুন পণ্য) ──────────────────────────────────────────────────
// Sorts by createdAt desc — LatestProducts strip, always fresh inventory first.
export const findNewArrivalProductServices = async (
  limit: number,
  skip: number,
): Promise<any> => {
  const baseMatch = { product_status: "active" };
  const categoryBrandFilters = [
    { $lookup: { from: "categories", localField: "category_id", foreignField: "_id", as: "category" } },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: false } },
    { $lookup: { from: "brands", localField: "brand_id", foreignField: "_id", as: "brand" } },
    { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },
    { $match: { "category.category_status": "active", $or: [{ "brand.brand_status": "active" }, { brand: null }] } },
  ];

  const totalData = await ProductModel.aggregate([
    { $match: baseMatch },
    ...categoryBrandFilters,
    { $count: "total" },
  ]);
  const totalCount = totalData.length > 0 ? totalData[0].total : 0;

  const products = await ProductModel.aggregate([
    { $match: baseMatch },
    ...categoryBrandFilters,
    { $lookup: { from: "variations", localField: "_id", foreignField: "product_id", as: "variations" } },
    {
      $addFields: {
        variations: {
          $map: {
            input: "$variations", as: "v",
            in: { _id: "$$v._id", variation_name: "$$v.variation_name", product_id: "$$v.product_id", variation_price: "$$v.variation_price", variation_discount_price: "$$v.variation_discount_price", variation_quantity: "$$v.variation_quantity", variation_image: "$$v.variation_image", variation_video: "$$v.variation_video" },
          },
        },
      },
    },
    {
      $lookup: {
        from: "reviews", localField: "_id", foreignField: "review_product_id", as: "reviews",
        pipeline: [{ $match: { review_status: "active" } }],
      },
    },
    {
      $addFields: {
        average_review_rating: { $cond: { if: { $gt: [{ $size: "$reviews" }, 0] }, then: { $divide: [{ $sum: "$reviews.review_ratting" }, { $size: "$reviews" }] }, else: 0 } },
        total_reviews: { $size: "$reviews" },
      },
    },
    { $project: { _id: 1, product_name: 1, product_slug: 1, main_image: 1, other_images: { $cond: { if: { $eq: ["$is_variation", false] }, then: { $arrayElemAt: ["$other_images", 0] }, else: "$$REMOVE" } }, main_video: 1, product_price: 1, product_discount_price: 1, createdAt: 1, updatedAt: 1, category: { _id: 1, category_name: 1, category_slug: 1 }, brand: { _id: 1, brand_name: 1 }, is_variation: 1, variations: { $cond: { if: { $eq: ["$is_variation", true] }, then: { $arrayElemAt: ["$variations", 0] }, else: {} } }, attributes_details: 1, average_review_rating: 1, total_reviews: 1 } },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
  ]);

  const flashMap = await findActiveFlashMapForProducts(products.map((p: any) => p._id));
  const enriched = products.map((p: any) => {
    const flash = flashMap.get(String(p._id));
    return flash ? { ...p, flash_sale_details: { flash_sale_product: flash } } : p;
  });

  return { data: enriched, totalCount };
};

// ─── Most Viewed (সর্বাধিক দেখা) ─────────────────────────────────────────────
// Sorts by view_count desc — bumpProductViewCount increments on every PDP fetch.
// Phase 1: lifetime total only; windowed tracking deferred.
export const findMostViewedProductServices = async (
  limit: number,
  skip: number,
): Promise<any> => {
  const baseMatch = { product_status: "active" };
  const categoryBrandFilters = [
    { $lookup: { from: "categories", localField: "category_id", foreignField: "_id", as: "category" } },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: false } },
    { $lookup: { from: "brands", localField: "brand_id", foreignField: "_id", as: "brand" } },
    { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },
    { $match: { "category.category_status": "active", $or: [{ "brand.brand_status": "active" }, { brand: null }] } },
  ];

  const totalData = await ProductModel.aggregate([
    { $match: baseMatch },
    ...categoryBrandFilters,
    { $count: "total" },
  ]);
  const totalCount = totalData.length > 0 ? totalData[0].total : 0;

  const products = await ProductModel.aggregate([
    { $match: baseMatch },
    ...categoryBrandFilters,
    { $lookup: { from: "variations", localField: "_id", foreignField: "product_id", as: "variations" } },
    {
      $addFields: {
        variations: {
          $map: {
            input: "$variations", as: "v",
            in: { _id: "$$v._id", variation_name: "$$v.variation_name", product_id: "$$v.product_id", variation_price: "$$v.variation_price", variation_discount_price: "$$v.variation_discount_price", variation_quantity: "$$v.variation_quantity", variation_image: "$$v.variation_image", variation_video: "$$v.variation_video" },
          },
        },
      },
    },
    {
      $lookup: {
        from: "reviews", localField: "_id", foreignField: "review_product_id", as: "reviews",
        pipeline: [{ $match: { review_status: "active" } }],
      },
    },
    {
      $addFields: {
        average_review_rating: { $cond: { if: { $gt: [{ $size: "$reviews" }, 0] }, then: { $divide: [{ $sum: "$reviews.review_ratting" }, { $size: "$reviews" }] }, else: 0 } },
        total_reviews: { $size: "$reviews" },
      },
    },
    { $project: { _id: 1, product_name: 1, product_slug: 1, main_image: 1, other_images: { $cond: { if: { $eq: ["$is_variation", false] }, then: { $arrayElemAt: ["$other_images", 0] }, else: "$$REMOVE" } }, main_video: 1, product_price: 1, product_discount_price: 1, view_count: 1, createdAt: 1, updatedAt: 1, category: { _id: 1, category_name: 1, category_slug: 1 }, brand: { _id: 1, brand_name: 1 }, is_variation: 1, variations: { $cond: { if: { $eq: ["$is_variation", true] }, then: { $arrayElemAt: ["$variations", 0] }, else: {} } }, attributes_details: 1, average_review_rating: 1, total_reviews: 1 } },
    { $sort: { view_count: -1, _id: -1 } },
    { $skip: skip },
    { $limit: limit },
  ]);

  const flashMap = await findActiveFlashMapForProducts(products.map((p: any) => p._id));
  const enriched = products.map((p: any) => {
    const flash = flashMap.get(String(p._id));
    return flash ? { ...p, flash_sale_details: { flash_sale_product: flash } } : p;
  });

  return { data: enriched, totalCount };
};

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
        $or: [{ "brand.brand_status": "active" }, { brand: null }],
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
        from: "reviews",
        localField: "_id",
        foreignField: "review_product_id",
        as: "reviews",
        pipeline: [{ $match: { review_status: "active" } }],
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
        $or: [
          { "brand.brand_status": "active" }, // Allow active brand
          { brand: null }, // Or no brand
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
        // Boutique home (product_features) needs the FULL variation list — each
        // pack-size as a clickable chip that swaps image/video + price. Separate
        // field so the existing first-only `variations` (ProductCard relies on
        // it) is untouched. Empty array for simple products; other consumers
        // simply ignore this field.
        variation_options: {
          $cond: {
            if: { $eq: ["$is_variation", true] },
            then: {
              $map: {
                input: "$variations",
                as: "v",
                in: {
                  _id: "$$v._id",
                  variation_name: "$$v.variation_name",
                  variation_price: "$$v.variation_price",
                  variation_discount_price: "$$v.variation_discount_price",
                  variation_quantity: "$$v.variation_quantity",
                  variation_image: "$$v.variation_image",
                  variation_video: "$$v.variation_video",
                  combination: "$$v.combination",
                },
              },
            },
            else: [],
          },
        },
        campaign_details: {
          $cond: {
            if: { $ne: ["$campaign_details.campaign_product", null] },
            then: "$campaign_details",
            else: null,
          },
        },
        attributes_details: 1,
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

  const flashMapEC = await findActiveFlashMapForProducts(findECommerceChoiceProduct.map((p: any) => p._id));
  const enrichedEC = findECommerceChoiceProduct.map((p: any) => {
    const flash = flashMapEC.get(String(p._id));
    return flash ? { ...p, flash_sale_details: { flash_sale_product: flash } } : p;
  });

  // Return both the data and total count
  return {
    data: enrichedEC,
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
            from: "reviews",
            localField: "_id",
            foreignField: "review_product_id",
            as: "reviews",
            pipeline: [{ $match: { review_status: "active" } }],
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
            $or: [
              { "brand.brand_status": "active" }, // Allow active brand
              { brand: null }, // Or no brand
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
        const flashMapJFY = await findActiveFlashMapForProducts(findJustForYouProduct.map((p: any) => p._id));
        const enrichedJFY = findJustForYouProduct.map((p: any) => {
          const flash = flashMapJFY.get(String(p._id));
          return flash ? { ...p, flash_sale_details: { flash_sale_product: flash } } : p;
        });
        return { categoryDetails: category, products: enrichedJFY };
      }
      return null;
    }),
  );

  // ✅ Filter out null entries
  return matchedProductsByCategory.filter((entry) => entry !== null);
};

// Partial update of a product's themed page-content ONLY. Unlike
// updateProductServices (which the full product-edit form uses and which
// rebuilds the whole document), this whitelists page-content fields and $sets
// just those — so the admin Page Content form can save without touching price,
// stock, category, name, etc. theme_id "" / null is treated as "clear theme".
const PAGE_CONTENT_FIELDS = [
  "theme_id",
  "description",
  "custom_fields",
  "short_description",
  "benefits_side_image",
  "benefits_side_image_key",
  "use_cases_side_image",
  "use_cases_side_image_key",
  "faq_side_image",
  "faq_side_image_key",
  "benefits_side_image_show",
  "use_cases_side_image_show",
  "faq_side_image_show",
  "size_guide_title",
  "size_guide_note",
  "size_guide_columns",
  "size_guide_rows",
  "badge_text",
  "hero_corner_badge",
  "video_title",
  "video_link",
  "benefits",
  "short_features",
  "process_steps",
  "use_cases",
  "faqs",
  "floating_images",
  "floating_overrides",
  "nutrition",
  "og_image",
  "og_image_key",
  "og_title",
  "og_description",
  "product_updated_by",
] as const;

export const updateProductPageContentServices = async (
  _id: any,
  data: any,
): Promise<any> => {
  const exists = await ProductModel.findById(_id).select("_id");
  if (!exists) {
    throw new Error("Product not found");
  }

  const set: any = {};
  const unset: any = {};
  for (const field of PAGE_CONTENT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(data, field)) continue;
    const value = data[field];
    // theme_id: explicit `null` clears the theme (admin "remove theme"
    // button); `undefined` / missing key = no change (skip). Empty string
    // is treated as `undefined` to guard against form-load races where the
    // dropdown sends "" before its options resolve. Item 10 audit follow-up:
    // previously even `null` was skipped, so theme was unclearable anywhere.
    if (field === "theme_id") {
      if (value === undefined || value === "") continue;
      if (value === null) {
        unset.theme_id = "";
        continue;
      }
      set.theme_id = value;
      continue;
    }
    // Free-form spec rows — normalize the same way the full-create controller
    // does (trim label/value, drop rows missing either, keep optional icon_key)
    // so the Page Content editor can't persist half-filled / raw rows.
    if (field === "custom_fields") {
      const arr = Array.isArray(value) ? value : [];
      set.custom_fields = arr
        .map((row: any) => ({
          label: String(row?.label ?? "").trim(),
          value: String(row?.value ?? "").trim(),
          icon_key: row?.icon_key ? String(row.icon_key) : undefined,
        }))
        .filter((row: any) => row.label && row.value);
      continue;
    }
    // benefits: per-item {text, icon_url?, icon_key?}. Accept BOTH the new
    // object rows AND legacy plain strings (older clients / migration) and
    // normalize to the object shape; drop rows with no text.
    if (field === "benefits") {
      const arr = Array.isArray(value) ? value : [];
      set.benefits = arr
        .map((row: any) => {
          if (typeof row === "string") return { text: row.trim() };
          return {
            text: String(row?.text ?? "").trim(),
            icon_url: row?.icon_url ? String(row.icon_url) : undefined,
            icon_key: row?.icon_key ? String(row.icon_key) : undefined,
          };
        })
        .filter((row: any) => row.text);
      continue;
    }
    // Side-image visibility toggles are booleans. Normalize explicitly because
    // a form could send the string "false", which Mongoose casts to `true`.
    if (
      field === "benefits_side_image_show" ||
      field === "use_cases_side_image_show" ||
      field === "faq_side_image_show"
    ) {
      set[field] = value === true || value === "true";
      continue;
    }
    // Size-guide grid: columns is a flat string[]; rows is string[][] where each
    // row's cell count is padded/truncated to the column count so the PDP table
    // never renders ragged (a row with fewer cells than headers, or extras).
    // Trim empty trailing columns/rows so a half-filled paste doesn't persist.
    if (field === "size_guide_columns") {
      const cols = (Array.isArray(value) ? value : [])
        .map((c: any) => String(c ?? "").trim())
        .slice(0, 8); // cap (MEDIUM)
      // drop trailing empty headers
      while (cols.length && !cols[cols.length - 1]) cols.pop();
      set.size_guide_columns = cols;
      continue;
    }
    if (field === "size_guide_rows") {
      // Need the resolved column count to pad rows. Prefer the columns coming in
      // the same payload; fall back to the longest row if columns weren't sent.
      const incomingCols = Array.isArray(data?.size_guide_columns)
        ? data.size_guide_columns.filter((c: any) => String(c ?? "").trim())
            .length
        : 0;
      const rawRows = (Array.isArray(value) ? value : [])
        .map((r: any) => (Array.isArray(r) ? r.map((c) => String(c ?? "").trim()) : []))
        .slice(0, 30); // cap (MEDIUM)
      const width =
        incomingCols ||
        rawRows.reduce((m: number, r: string[]) => Math.max(m, r.length), 0);
      const rows = rawRows
        // pad/truncate each row to `width`
        .map((r: string[]) => {
          const out = r.slice(0, width);
          while (out.length < width) out.push("");
          return out;
        })
        // drop fully-empty rows
        .filter((r: string[]) => r.some((c) => c));
      set.size_guide_rows = rows;
      continue;
    }
    set[field] = value;
  }

  const update: any = {};
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(unset).length) update.$unset = unset;

  // findOneAndUpdate so the theme-usage counter pre/post hooks in
  // product.model.ts fire when theme_id changes/clears (Item 10 audit).
  // Without this, themes.used_in_products drifts and is_deletable goes stale.
  return ProductModel.findOneAndUpdate({ _id }, update, {
    new: true,
    runValidators: true,
  });
};

// update A Product
//
// Item 10 fix (2026-06-05): optional foreign keys need explicit $unset on
// clear because the full-edit controller always sets the key in `data` —
// either with a value, or with undefined when admin removed the selection.
// Mongoose treats `$set: { brand_id: undefined }` as a no-op and would leave
// the stale id behind, so the admin's "remove brand" click silently failed.
// We scan an allow-list and divert any falsy/empty-string/null value into
// $unset.
//
// Item 10 post-hoc audit (2026-06-05) — expanded OPTIONAL_FK_FIELDS to also
// cover `product_supplier_id`, `warehouse_id`, and `theme_id`. All three had
// the same silent-fail-on-clear bug; the audit also flagged that switching
// from `updateOne` to `findOneAndUpdate` is required for the existing
// theme-usage counter hooks in product.model.ts (pre/post findOneAndUpdate)
// to actually fire — otherwise theme.used_in_products drifts permanently.
//
// `category_path` is intentionally NOT in the allow-list: the controller
// always sends it as `[]` for "no category" (via resolveProductCategoryPath),
// and `$set: { category_path: [] }` correctly wipes the array.
const OPTIONAL_FK_FIELDS = [
  "brand_id",
  "category_id",
  "product_supplier_id",
  "warehouse_id",
  "theme_id",
] as const;

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
  const updateData: any = { ...data };
  const unsetData: any = {};

  for (const field of OPTIONAL_FK_FIELDS) {
    const present = Object.prototype.hasOwnProperty.call(data, field);
    const value = (data as any)[field];
    const isCleared =
      !present || value === undefined || value === null || value === "";
    if (isCleared) {
      unsetData[field] = "";
      delete updateData[field];
    }
  }

  const writeOps: any = {};
  if (Object.keys(updateData).length) writeOps.$set = updateData;
  if (Object.keys(unsetData).length) writeOps.$unset = unsetData;

  // findOneAndUpdate (not updateOne) so the theme-usage counter pre/post
  // hooks in product.model.ts fire — they track theme_id transitions and
  // keep themes.used_in_products in sync (drives the is_deletable flag).
  // updateOne does NOT fire those hooks by Mongoose design.
  const updateProduct = await ProductModel.findOneAndUpdate(
    { _id },
    writeOps,
    { new: true, runValidators: true },
  );

  // Match the old return shape (controller checks `result?.modifiedCount`).
  // We can't easily compute modifiedCount from findOneAndUpdate, so synthesize
  // it as 1 if a doc was returned (it always returns the post-update doc when
  // matched). Callers downstream only check truthiness; this is safe.
  return updateProduct
    ? { acknowledged: true, modifiedCount: 1, matchedCount: 1 }
    : { acknowledged: true, modifiedCount: 0, matchedCount: 0 };
};

// Find all dashboard Product
export const findAllDashboardProductServices = async (
  limit: number,
  skip: number,
  searchTerm: any,
  categoryId?: string,
  brandId?: string,
  stockFilter?: string,
): Promise<any> => {
  const andCondition: any[] = [];
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
  if (categoryId) {
    andCondition.push({ category_id: categoryId });
  }
  if (brandId) {
    andCondition.push({ brand_id: brandId });
  }
  if (stockFilter === "in_stock") {
    andCondition.push({ product_quantity: { $gt: 0 } });
  } else if (stockFilter === "low_stock") {
    andCondition.push({ product_quantity: { $gt: 0, $lte: 10 } });
  }

  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};

  // Step 1: Fetch products — strip heavy fields not needed for list view.
  // No populate here: some legacy docs store non-ObjectId strings in category_id/brand_id
  // which causes Mongoose "Parameter obj to Document() must be an object" crash.
  const products = await ProductModel.find(whereCondition)
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .select(
      "_id product_name product_slug product_sku main_image product_price " +
      "product_sale_price product_quantity product_status is_variation",
    )
    .lean();

  // Step 2: Single bulk query for all variations (avoids N+1)
  const variationProductIds = products
    .filter((p) => p.is_variation)
    .map((p) => p._id);

  const allVariations = variationProductIds.length
    ? await VariationModel.find({ product_id: { $in: variationProductIds } })
        .select(
          "_id product_id variation_name variation_price variation_sale_price " +
          "variation_discount_price variation_quantity variation_image variation_images variation_sku",
        )
        .lean()
    : [];

  // Group variations by product_id
  const variationsByProduct: Record<string, any[]> = {};
  for (const v of allVariations) {
    const key = String(v.product_id);
    if (!variationsByProduct[key]) variationsByProduct[key] = [];
    variationsByProduct[key].push(v);
  }

  return products.map((p) => ({
    ...p,
    variations: variationsByProduct[String(p._id)] || [],
  }));
};

// Find a dashboard Product
export const findADashboardProductServices = async (
  _id: string,
): Promise<any | null> => {
  // Step 1: Find the product by its ID and populate related fields.
  // SECURITY: explicitly strip admin_password (bcrypt hash) from any populated
  // admin doc — older code leaked it via the publisher / updated_by populate.
  const findProduct = await ProductModel.findOne({ _id })
    .populate([
      { path: "category_id" },
      { path: "brand_id" },
      { path: "product_publisher_id", select: "-admin_password" },
      { path: "product_updated_by", select: "-admin_password" },
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

// ─────────────────────────────────────────────────────────────────────────────
// A2 (2026-06-04) — operational dashboard for the rewritten product list.
//
// `findAllDashboardProductRichServices` returns each row pre-annotated with
// computed fields the list page needs (variation count, total stock, flag
// indicators). Keeps the original `/dashboard` endpoint untouched so any other
// consumer (e.g. existing reports) keep working.
//
// Stock authority rule (owner-locked): when a product has variations, the
// variation sum IS the truth — product_quantity is ignored. Migration script
// zeroes product_quantity for those products at deploy time.
// ─────────────────────────────────────────────────────────────────────────────
export const findAllDashboardProductRichServices = async (
  limit: number,
  skip: number,
  searchTerm: any,
  filters: {
    status?: string;
    stock?: string;
    has_variation?: string;
    category_id?: string;
    brand_id?: string;
    has_theme?: string;
    product_type?: string;
  },
  sort: string,
): Promise<any> => {
  const andCondition: any[] = [];
  if (searchTerm) {
    andCondition.push({
      $or: productSearchableField.map((field) => ({
        [field]: { $regex: searchTerm, $options: "i" },
      })),
    });
  }
  if (filters.status === "active" || filters.status === "in-active") {
    andCondition.push({ product_status: filters.status });
  }
  if (filters.has_variation === "yes") {
    andCondition.push({ is_variation: true });
  } else if (filters.has_variation === "no") {
    andCondition.push({ is_variation: { $ne: true } });
  }
  if (filters.category_id) {
    andCondition.push({ category_id: new Types.ObjectId(filters.category_id) });
  }
  if (filters.brand_id) {
    andCondition.push({ brand_id: new Types.ObjectId(filters.brand_id) });
  }
  if (filters.has_theme === "yes") {
    andCondition.push({ theme_id: { $exists: true, $ne: null } });
  } else if (filters.has_theme === "no") {
    andCondition.push({
      $or: [{ theme_id: { $exists: false } }, { theme_id: null }],
    });
  }
  if (filters.product_type) {
    andCondition.push({ product_type: filters.product_type });
  }
  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};

  // Sort map — owner-friendly keys → mongo sort.
  const sortMap: Record<string, any> = {
    updated_desc: { updatedAt: -1 },
    updated_asc: { updatedAt: 1 },
    name_asc: { product_name: 1 },
    name_desc: { product_name: -1 },
    price_desc: { product_price: -1 },
    price_asc: { product_price: 1 },
    sold_desc: { sold_count: -1 },
    new: { _id: -1 },
  };
  const sortStage = sortMap[sort] || sortMap["new"];

  const products: any[] = await ProductModel.find(whereCondition)
    .populate([
      { path: "category_id", select: "category_name category_slug" },
      { path: "brand_id", select: "brand_name" },
      { path: "product_publisher_id", select: "admin_name" },
      { path: "product_updated_by", select: "admin_name" },
    ])
    .sort(sortStage)
    .skip(skip)
    .limit(limit)
    .select("-__v -description")
    .lean();

  // Variation roll-up — one batched query for the page.
  const variationProductIds = products
    .filter((p) => p?.is_variation)
    .map((p) => p._id);
  const variationAgg = variationProductIds.length
    ? await VariationModel.aggregate([
        { $match: { product_id: { $in: variationProductIds } } },
        {
          $group: {
            _id: "$product_id",
            count: { $sum: 1 },
            stock_total: { $sum: { $ifNull: ["$variation_quantity", 0] } },
            active_count: {
              $sum: { $cond: [{ $ne: ["$is_active", false] }, 1, 0] },
            },
          },
        },
      ])
    : [];
  const variationMap = new Map<string, any>();
  variationAgg.forEach((row) => variationMap.set(String(row._id), row));

  // Stock-filter is post-aggregate because variation sum drives it.
  const annotated = products
    .map((p) => {
      const variationStats = variationMap.get(String(p._id));
      const variation_count = variationStats?.count || 0;
      const stock_total = p.is_variation
        ? variationStats?.stock_total || 0
        : p.product_quantity || 0;
      const alert_qty = p.product_alert_quantity || 0;
      const flags: string[] = [];
      if (p.trending_product) flags.push("trending");
      if (p.product_campaign_id) flags.push("campaign");
      if (p.theme_id) flags.push("theme");
      if ((p.faqs?.length || 0) > 0 || (p.benefits?.length || 0) > 0) {
        flags.push("page_content");
      }
      if ((p.tier_prices?.length || 0) > 0) flags.push("tier_pricing");
      if (p.product_weight_grams) flags.push("weight");
      if (p.condition && p.condition !== "new") flags.push(p.condition);

      return {
        ...p,
        _variation_count: variation_count,
        _variation_active_count: variationStats?.active_count || 0,
        _stock_total: stock_total,
        _is_low_stock: alert_qty > 0 && stock_total <= alert_qty,
        _is_out_of_stock: stock_total <= 0,
        _flags: flags,
        _has_theme: !!p.theme_id,
        _has_page_content:
          (p.faqs?.length || 0) > 0 ||
          (p.benefits?.length || 0) > 0 ||
          (p.short_features?.length || 0) > 0,
      };
    })
    .filter((p) => {
      if (filters.stock === "in") return p._stock_total > 0;
      if (filters.stock === "out") return p._stock_total <= 0;
      if (filters.stock === "low") return p._is_low_stock;
      return true;
    });

  return annotated;
};

// A2 — countDocuments alongside the rich list. Stock filter cannot be pushed
// to mongo cheaply (depends on variation aggregation), so the totalData here
// reflects pre-stock-filter count; admin pagination still works correctly for
// the other filters which is the common case.
export const countDashboardProductRichServices = async (
  searchTerm: any,
  filters: {
    status?: string;
    has_variation?: string;
    category_id?: string;
    brand_id?: string;
    has_theme?: string;
    product_type?: string;
  },
): Promise<number> => {
  const andCondition: any[] = [];
  if (searchTerm) {
    andCondition.push({
      $or: productSearchableField.map((field) => ({
        [field]: { $regex: searchTerm, $options: "i" },
      })),
    });
  }
  if (filters.status === "active" || filters.status === "in-active") {
    andCondition.push({ product_status: filters.status });
  }
  if (filters.has_variation === "yes") {
    andCondition.push({ is_variation: true });
  } else if (filters.has_variation === "no") {
    andCondition.push({ is_variation: { $ne: true } });
  }
  if (filters.category_id) {
    andCondition.push({ category_id: new Types.ObjectId(filters.category_id) });
  }
  if (filters.brand_id) {
    andCondition.push({ brand_id: new Types.ObjectId(filters.brand_id) });
  }
  if (filters.has_theme === "yes") {
    andCondition.push({ theme_id: { $exists: true, $ne: null } });
  } else if (filters.has_theme === "no") {
    andCondition.push({
      $or: [{ theme_id: { $exists: false } }, { theme_id: null }],
    });
  }
  if (filters.product_type) {
    andCondition.push({ product_type: filters.product_type });
  }
  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};
  return ProductModel.countDocuments(whereCondition);
};

// ─────────────────────────────────────────────────────────────────────────────
// A2 — `patchProductQuickServices`: whitelisted partial-update endpoint.
//
// The existing `PATCH /product` route is a full-rebuild flow (memory note:
// product-update-route-is-full-rebuild) — passing a partial body wipes
// fields not in the payload. The list page's quick toggles (status,
// trending) and the per-column edit modals (price, stock, video_link, tier
// prices) MUST go through this safe path instead.
//
// Whitelist is locked here so the list page cannot accidentally clobber
// schema fields it has no business touching.
// ─────────────────────────────────────────────────────────────────────────────
const PRODUCT_QUICK_WHITELIST = [
  "product_status",
  "trending_product",
  "product_price",
  "product_buying_price",
  "product_discount_price",
  "product_quantity",
  "product_alert_quantity",
  "tier_prices",
  "unit",
  "video_link",
  "condition",
  "delivery_mode",
  "delivery_flat_amount",
  "delivery_free_after_qty",
  // Analytics seed — admin-seeded baseline counts; real orders/views accumulate on top
  "sold_count",
  "view_count",
];

export const patchProductQuickServices = async (
  _id: string,
  body: Record<string, any>,
  updatedBy: any,
): Promise<any> => {
  if (!_id) throw new ApiError(400, "product id required");
  const existing = await ProductModel.findById(_id).lean();
  if (!existing) throw new ApiError(404, "Product not found");

  const update: Record<string, any> = {};
  for (const key of PRODUCT_QUICK_WHITELIST) {
    if (body[key] !== undefined) update[key] = body[key];
  }
  if (Object.keys(update).length === 0) {
    throw new ApiError(400, "No valid fields to update");
  }

  // A2 owner rule: when product becomes a variation product, product_quantity
  // is irrelevant. Block the front-door if caller tries to set it. This stays
  // consistent with the migration script (sets to 0 for variation products).
  if (existing.is_variation && "product_quantity" in update) {
    delete update.product_quantity;
  }

  if (updatedBy) update.product_updated_by = updatedBy;

  const result = await ProductModel.findByIdAndUpdate(
    _id,
    { $set: update },
    { new: true, runValidators: true },
  ).lean();

  // Audit trail — log seed count changes (sold_count / view_count) to history collection.
  const countFields = ["sold_count", "view_count"];
  const countChanges: Record<string, any> = {};
  for (const field of countFields) {
    if (update[field] !== undefined) countChanges[field] = update[field];
  }
  if (Object.keys(countChanges).length > 0) {
    ProductCountHistoryModel.create({
      product_id: _id,
      changed_by: updatedBy,
      changes: countChanges,
    }).catch(() => {}); // fire-and-forget, never block the response
  }

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// A2 — `patchProductImagesServices`: dedicated multipart image manager.
//
// Lets the Images Modal:
//   1. Swap `main_image` (uploads new + cleans old S3 key)
//   2. Add to `other_images[]`
//   3. Replace the full `other_images[]` ordering (drag-reorder result)
//   4. Remove specific other_images entries by S3 key
//
// Body fields:
//   - mode: "swap_main" | "add_other" | "reorder" | "remove_other"
//   - removed_keys: string[] (for remove_other)
//   - ordered_keys: string[] (for reorder — must be subset of existing)
//   - files: multer files (main_image[1], other_images[N])
// ─────────────────────────────────────────────────────────────────────────────
export const patchProductImagesServices = async (
  _id: string,
  mode: string,
  files: any,
  body: { removed_keys?: string[]; ordered_keys?: string[] },
  updatedBy: any,
): Promise<any> => {
  if (!_id) throw new ApiError(400, "product id required");
  const product = await ProductModel.findById(_id);
  if (!product) throw new ApiError(404, "Product not found");

  const mainFile = files?.main_image?.[0];
  const otherFiles: any[] = files?.other_images || [];

  if (mode === "swap_main") {
    if (!mainFile) throw new ApiError(400, "main_image file required");
    // Upload new first, swap, then delete old key (only if not still
    // referenced elsewhere on the same product).
    const uploaded = await FileUploadHelper.uploadToSpaces(mainFile);
    const oldKey = product.main_image_key;
    product.main_image = uploaded.Location;
    product.main_image_key = uploaded.Key;
    await product.save();
    if (oldKey && oldKey !== uploaded.Key) {
      const stillRef = await collectAllProductImageRefs(String(product._id));
      if (!stillRef.keys.has(oldKey)) {
        try {
          await FileUploadHelper.deleteFromSpaces(oldKey);
        } catch (err) {
          // Swallow — orphaned S3 object is harmless, image swap succeeded.
        }
      }
    }
  } else if (mode === "add_other") {
    if (!otherFiles.length) throw new ApiError(400, "other_images required");
    const uploaded = await Promise.all(
      otherFiles.map((f: any) => FileUploadHelper.uploadToSpaces(f)),
    );
    const newEntries = uploaded.map((u) => ({
      other_image: u.Location,
      other_image_key: u.Key,
    }));
    product.other_images = [
      ...((product.other_images as any[]) || []),
      ...newEntries,
    ] as any;
    await product.save();
  } else if (mode === "remove_other") {
    const removedKeys = body.removed_keys || [];
    if (!removedKeys.length) {
      throw new ApiError(400, "removed_keys required");
    }
    const before = (product.other_images as any[]) || [];
    const after = before.filter(
      (o: any) => !removedKeys.includes(o?.other_image_key),
    );
    product.other_images = after as any;
    await product.save();
    // Delete S3 objects only if not referenced elsewhere on the same product.
    const stillRef = await collectAllProductImageRefs(String(product._id));
    for (const key of removedKeys) {
      if (!stillRef.keys.has(key)) {
        try {
          await FileUploadHelper.deleteFromSpaces(key);
        } catch {
          // Swallow — already-deleted or permission issue; not fatal.
        }
      }
    }
  } else if (mode === "reorder") {
    const orderedKeys = body.ordered_keys || [];
    if (!orderedKeys.length) {
      throw new ApiError(400, "ordered_keys required");
    }
    const existing = (product.other_images as any[]) || [];
    // Legacy uploads may have entries without `other_image_key`. They can't
    // appear in `ordered_keys` (FE filters them out), so the keyed-equality
    // check would falsely 400. Fix: only enforce length parity against the
    // KEYED subset; keyless legacy entries are preserved appended to the end.
    const keyed = existing.filter((o: any) => o?.other_image_key);
    const keyless = existing.filter((o: any) => !o?.other_image_key);
    const map = new Map<string, any>(
      keyed.map((o: any) => [o.other_image_key, o]),
    );
    const reordered = orderedKeys.map((k) => map.get(k)).filter(Boolean);
    if (reordered.length !== keyed.length) {
      throw new ApiError(
        400,
        "ordered_keys must reference every keyed image exactly once",
      );
    }
    product.other_images = [...reordered, ...keyless] as any;
    await product.save();
  } else if (mode === "swap_video") {
    // Upload/replace the product's main_video (mp4/mov/webm). Video lives only
    // in product.main_video — it isn't shared like images, so we delete the old
    // key directly after a successful swap. The uploaded file arrives under the
    // `main_video` multer fieldname (grouped by the controller).
    const videoFile = files?.main_video?.[0];
    if (!videoFile) throw new ApiError(400, "main_video file required");
    // VideoUploader puts the file under fruit_snacks_videos/ with a URL-encoded
    // key (handles spaces/unicode in filenames) — same path the full product
    // route uses, so PDP/admin render videos identically regardless of which
    // route uploaded them.
    const uploaded = await FileUploadHelper.VideoUploader(videoFile);
    const oldKey = (product as any).main_video_key;
    (product as any).main_video = uploaded.Location;
    (product as any).main_video_key = uploaded.Key;
    await product.save();
    if (oldKey && oldKey !== uploaded.Key) {
      try {
        await FileUploadHelper.deleteFromSpaces(oldKey);
      } catch {
        // Swallow — orphaned S3 video is harmless; the swap already succeeded.
      }
    }
  } else if (mode === "remove_video") {
    const oldKey = (product as any).main_video_key;
    (product as any).main_video = "";
    (product as any).main_video_key = "";
    await product.save();
    if (oldKey) {
      try {
        await FileUploadHelper.deleteFromSpaces(oldKey);
      } catch {
        // Swallow — already-deleted or permission issue; not fatal.
      }
    }
  } else {
    throw new ApiError(400, `Unknown mode: ${mode}`);
  }

  if (updatedBy) {
    product.product_updated_by = updatedBy;
    await product.save();
  }

  return ProductModel.findById(_id).lean();
};

// ─────────────────────────────────────────────────────────────────────────────
// Batch 2 D — within-product reference-counted image cleanup
//
// An S3 image URL may appear in MULTIPLE places on the same product:
//   - product.main_image
//   - product.other_images[].other_image
//   - variation.variation_image (legacy single)
//   - variation.variation_images[] (C1 multi)
//
// `collectAllProductImageUrls` returns the union (key + url) so callers can
// either (a) delete every S3 object when the product is hard-deleted, or
// (b) check "is this URL still referenced anywhere on this product?" before
// deleting a specific S3 object after an image swap. Scope intentionally
// within-product only — cross-product reuse is rare at single-shop scale.
// ─────────────────────────────────────────────────────────────────────────────
export const collectAllProductImageRefs = async (
  productId: string,
): Promise<{ urls: Set<string>; keys: Set<string> }> => {
  const urls = new Set<string>();
  const keys = new Set<string>();
  const product = await ProductModel.findById(productId).lean();
  if (!product) return { urls, keys };

  if (product.main_image) urls.add(product.main_image);
  if (product.main_image_key) keys.add(product.main_image_key);
  if (product.size_chart) urls.add(product.size_chart);
  if (product.size_chart_key) keys.add(product.size_chart_key);
  // main_video has its own S3 key alongside the URL.
  if (product.main_video) urls.add(product.main_video);
  if (product.main_video_key) keys.add(product.main_video_key);
  (product.other_images || []).forEach((o: any) => {
    if (o?.other_image) urls.add(o.other_image);
    if (o?.other_image_key) keys.add(o.other_image_key);
  });

  // Legacy full-page floats (back-compat) + the new section-anchored override
  // layer. These are PRODUCT-owned S3 objects, so they're cleaned on delete.
  // Theme floating_assets keys are intentionally NOT collected here — they're
  // theme-owned and shared across every product using that theme.
  (product.floating_images || []).forEach((f: any) => {
    if (f?.asset_url) urls.add(f.asset_url);
    if (f?.asset_key) keys.add(f.asset_key);
  });
  const fo: any = (product as any).floating_overrides;
  if (fo) {
    (fo.extras || []).forEach((e: any) => {
      if (e?.asset_url) urls.add(e.asset_url);
      if (e?.asset_key) keys.add(e.asset_key);
    });
    (fo.replacements || []).forEach((r: any) => {
      if (r?.asset_url) urls.add(r.asset_url);
      if (r?.asset_key) keys.add(r.asset_key);
    });
  }

  const variations = await VariationModel.find({ product_id: productId })
    .select(
      "variation_image variation_image_key variation_images variation_images_keys variation_video variation_video_key",
    )
    .lean();
  variations.forEach((v: any) => {
    if (v.variation_image) urls.add(v.variation_image);
    if (v.variation_image_key) keys.add(v.variation_image_key);
    (v.variation_images || []).forEach((u: string) => u && urls.add(u));
    (v.variation_images_keys || []).forEach((k: string) => k && keys.add(k));
    if (v.variation_video) urls.add(v.variation_video);
    if (v.variation_video_key) keys.add(v.variation_video_key);
  });

  return { urls, keys };
};

// Check whether a specific URL is still referenced anywhere on this product
// AFTER an in-memory edit (excluding the doc shape the caller already has —
// they pass in the new product/variations state). Use to decide whether to
// trigger an S3 delete on an image that's being swapped out.
export const isImageStillReferenced = (
  url: string,
  nextProduct: any,
  nextVariations: any[],
): boolean => {
  if (!url) return true; // nothing to delete anyway
  if (nextProduct?.main_image === url) return true;
  if ((nextProduct?.other_images || []).some((o: any) => o?.other_image === url))
    return true;
  for (const v of nextVariations || []) {
    if (v?.variation_image === url) return true;
    if ((v?.variation_images || []).includes(url)) return true;
  }
  return false;
};

// ─────────────────────────────────────────────────────────────────────────────
// Image-swap S3 orphan cleanup (Batch 2 D wire-in).
//
// Called from updateProduct AFTER the new product/variation docs are saved,
// with the BEFORE snapshot (existingProduct + existingVariations) and the
// AFTER state (nextProduct + nextVariations). Any S3 key that was in the
// BEFORE state but is no longer referenced anywhere in the AFTER state gets
// deleted from S3 (best-effort — failures swallowed, monthly orphan cron
// will catch stragglers).
//
// Cross-product reuse is NOT checked (per owner decision). Within-product
// reuse IS checked — if the admin reassigns the same URL to a different slot
// (e.g. moves main_image into other_images), the URL stays referenced and
// is not deleted.
// ─────────────────────────────────────────────────────────────────────────────
const collectKeysFromState = (
  product: any,
  variations: any[],
): { keys: Set<string>; urls: Set<string> } => {
  const keys = new Set<string>();
  const urls = new Set<string>();
  if (product?.main_image) urls.add(product.main_image);
  if (product?.main_image_key) keys.add(product.main_image_key);
  if (product?.size_chart) urls.add(product.size_chart);
  if (product?.size_chart_key) keys.add(product.size_chart_key);
  if (product?.main_video) urls.add(product.main_video);
  if (product?.main_video_key) keys.add(product.main_video_key);
  (product?.other_images || []).forEach((o: any) => {
    if (o?.other_image) urls.add(o.other_image);
    if (o?.other_image_key) keys.add(o.other_image_key);
  });
  (variations || []).forEach((v: any) => {
    if (v?.variation_image) urls.add(v.variation_image);
    if (v?.variation_image_key) keys.add(v.variation_image_key);
    (v?.variation_images || []).forEach((u: string) => u && urls.add(u));
    (v?.variation_images_keys || []).forEach((k: string) => k && keys.add(k));
    if (v?.variation_video) urls.add(v.variation_video);
    if (v?.variation_video_key) keys.add(v.variation_video_key);
  });
  return { keys, urls };
};

export const cleanupOrphanedProductMedia = async (
  prevProduct: any,
  prevVariations: any[],
  nextProductId: string,
): Promise<{ deleted: number; skipped: number }> => {
  const prev = collectKeysFromState(prevProduct, prevVariations);
  const nextProduct = await ProductModel.findById(nextProductId).lean();
  const nextVariations = await VariationModel.find({ product_id: nextProductId })
    .select(
      "variation_image variation_image_key variation_images variation_images_keys variation_video variation_video_key",
    )
    .lean();
  const next = collectKeysFromState(nextProduct, nextVariations);

  let deleted = 0;
  let skipped = 0;
  for (const key of prev.keys) {
    if (!key) continue;
    if (next.keys.has(key)) {
      skipped++;
      continue;
    }
    // Key dropped from the doc — also check whether the URL form still lives
    // somewhere (defensive — admin moving URL between slots without key).
    const urlForKey = Array.from(prev.urls).find((u) => u.includes(key));
    if (urlForKey && next.urls.has(urlForKey)) {
      skipped++;
      continue;
    }
    try {
      await FileUploadHelper.deleteFromSpaces(key);
      deleted++;
    } catch {
      // Best-effort. Monthly orphan-cleanup cron handles stragglers.
      skipped++;
    }
  }
  return { deleted, skipped };
};

// Delete a Product — cascades:
//   1. Collect all S3 image/video keys (main + others + variation media)
//   2. Best-effort S3 delete (don't throw on individual failures — orphan
//      cleanup will catch leftovers monthly via a future cron)
//   3. Delete all variations
//   4. Delete the product doc
//
// Reference scope is within-product only (per owner decision 2026-05-30).
// Cross-product checks are not done — single-shop scale rarely shares media.
export const deleteProductServices = async (
  _id: string,
): Promise<IProductInterface | any> => {
  const updateProductInfo: IProductInterface | null =
    await ProductModel.findOne({ _id: _id });
  if (!updateProductInfo) {
    throw new ApiError(404, "Product not found");
  }

  // Collect every S3 key associated with this product BEFORE deleting docs.
  const { keys } = await collectAllProductImageRefs(_id);
  for (const key of keys) {
    if (!key) continue;
    try {
      await FileUploadHelper.deleteFromSpaces(key);
    } catch {
      // Swallow — best-effort. A future monthly orphan-cleanup cron will
      // catch anything that slipped through.
    }
  }

  // Cascade variations (orphan rows otherwise).
  await VariationModel.deleteMany({ product_id: _id });

  const Product = await ProductModel.deleteOne(
    { _id: _id },
    {
      runValidators: true,
    },
  );
  return Product;
};

// Low-stock list (Phase B, B4). Returns simple products AND variations whose
// current stock has fallen to or below their alert threshold. Computed at query
// time (always accurate — no stored flag to drift). Only items with a positive
// alert threshold count, so products that never set one are never flagged.
export const findLowStockServices = async (): Promise<{
  products: any[];
  variations: any[];
}> => {
  // Simple (non-variation) products at/under their alert quantity.
  const products = await ProductModel.find({
    is_variation: { $ne: true },
    product_alert_quantity: { $gt: 0 },
    $expr: { $lte: ["$product_quantity", "$product_alert_quantity"] },
  })
    .select(
      "product_name product_slug main_image product_quantity product_alert_quantity",
    )
    .sort({ product_quantity: 1 })
    .lean();

  // Variations at/under their alert quantity, with parent product info.
  const variations = await VariationModel.find({
    variation_alert_quantity: { $gt: 0 },
    $expr: { $lte: ["$variation_quantity", "$variation_alert_quantity"] },
  })
    .select(
      "variation_name variation_quantity variation_alert_quantity product_id",
    )
    .populate({
      path: "product_id",
      model: "products",
      select: "product_name product_slug main_image",
    })
    .sort({ variation_quantity: 1 })
    .lean();

  return { products, variations };
};

// FAQ placeholder keys — distinct, slugged labels from every product's
// custom_fields (spec) + nutrition rows, plus the universal core keys. Powers
// the admin FAQ-template editor's clickable placeholder chips so a merchant
// sees what {{tokens}} their catalog supports without opening a product. Slug
// rule matches the admin/PDP fill logic (lowercase, ascii-alnum runs joined by
// underscore); non-ascii (e.g. Bangla) labels slug to "" and are dropped.
const slugifyPlaceholderKey = (label: string): string =>
  String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const listFaqPlaceholderKeysService = async (): Promise<{
  core: string[];
  fromProducts: Array<{ key: string; label: string }>;
}> => {
  const core = ["product_name", "price", "weight"];
  // Pull only the two label-bearing arrays across the catalog.
  const rows = await ProductModel.find(
    {},
    { custom_fields: 1, "nutrition.rows": 1 },
  ).lean();
  // slug → original label. Keep the FIRST human label we see for each slug so
  // the admin chip can show what {{c}} actually means (e.g. label "Color").
  const labelByKey = new Map<string, string>();
  const consider = (rawLabel: any) => {
    const label = String(rawLabel || "").trim();
    const k = slugifyPlaceholderKey(label);
    if (k && !labelByKey.has(k)) labelByKey.set(k, label);
  };
  for (const p of rows as any[]) {
    (p?.custom_fields || []).forEach((f: any) => consider(f?.label));
    (p?.nutrition?.rows || []).forEach((r: any) => consider(r?.label));
  }
  // Core keys are listed separately, so drop them from the product set.
  core.forEach((c) => labelByKey.delete(c));
  const fromProducts = Array.from(labelByKey.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.key.localeCompare(b.key));
  return { core, fromProducts };
};
