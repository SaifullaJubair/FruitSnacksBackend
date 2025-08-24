import mongoose, { Types } from "mongoose";
import {
  ICampaignInterface,
  campaignSearchableField,
} from "./campaign.interface";
import CampaignModel from "./campaign.model";
import { productSearchableField } from "../product/product.interface";
import ProductModel from "../product/product.model";
import VariationModel from "../variation/variation.model";
import ApiError from "../../errors/ApiError";

// Create A Campaign
export const postCampaignServices = async (
  data: ICampaignInterface
): Promise<ICampaignInterface | {}> => {
  const createCampaign: ICampaignInterface | {} | any =
    await CampaignModel.create(data);
  const campaignProducts = createCampaign?.campaign_products || [];

  for (const product of campaignProducts) {
    const { campaign_product_id } = product;

    // Update the product with the corresponding campaign_product_id
    await ProductModel.updateOne(
      { _id: campaign_product_id }, // Match the product using the campaign_product_id
      { $set: { product_campaign_id: createCampaign?._id } } // Set the product_campaign_id field
    );
  }
  return createCampaign;
};

// Find All Campaign
export const findAllCampaignServices = async (): Promise<
  ICampaignInterface[] | any
> => {
  const today = new Date();
  const todayStr = today.toISOString().substring(0, 10);
  const findCampaign: ICampaignInterface[] | any = await CampaignModel.find({
    campaign_status: "active",
    campaign_start_date: { $lte: todayStr },
    campaign_end_date: { $gte: todayStr },
  })
    .sort({ _id: -1 })
    .select(
      "-__v -campaign_products -campaign_publisher_id -campaign_updated_by -createdAt -updatedAt -campaign_image_key"
    );

  const sendData: any = [];

  for (const campaign of findCampaign) {
    // Convert the Mongoose document to a plain JavaScript object
    const campaignObj = campaign.toObject();
    sendData.push(campaignObj);
  }

  return sendData;
};

// Find A Campaign
export const findACampaignServices = async (
  _id: string
): Promise<ICampaignInterface | {}> => {
  const findCampaign = await CampaignModel.findOne({
    _id,
    campaign_status: "active",
  })
    .populate({
      path: "campaign_products.campaign_product_id",
      model: "products",
      populate: [
        {
          path: "brand_id",
          model: "brands",
          select: "_id brand_name brand_slug brand_status", // Select only `_id` and `brand_name`
        },
        {
          path: "category_id",
          model: "categories",
          select: "_id category_name category_slug category_status", // Select only `_id` and `category_name`
        },
        {
          path: "sub_category_id",
          model: "subcategories",
          select: "_id sub_category_name sub_category_slug sub_category_status", // Select only `_id` and `sub_category_name`
        },
        {
          path: "child_category_id",
          model: "childcategories",
          select:
            "_id child_category_name child_category_slug child_category_status", // Select only `_id` and `child_category_name`
        },
      ],
    })
    .select(
      "-__v -campaign_image_key -campaign_publisher_id -createdAt -updatedAt -campaign_updated_by"
    );

  if (!findCampaign) {
    throw new ApiError(404, "Campaign not found!");
  }

  // Ensure `campaign_products` exists and is an array
  const campaignProducts = findCampaign?.campaign_products ?? [];
  if (!Array.isArray(campaignProducts)) {
    throw new ApiError(400, "Invalid campaign products data!");
  }

  // Transform `campaign_products`
  const transformedCampaignProducts = await Promise.all(
    campaignProducts?.map(async (product: any) => {
      // Skip products that are not "active"
      if (product?.campaign_product_status !== "active") {
        return null;
      }

      const campaignProduct = product?.campaign_product_id;

      if (!campaignProduct) {
        return null;
      }

      if (campaignProduct?.product_status !== "active") {
        return null;
      }

      if (campaignProduct?.category_id?.category_status !== "active") {
        return null;
      }
      if (
        campaignProduct?.sub_category_id &&
        campaignProduct?.sub_category_id?.sub_category_status !== "active"
      ) {
        return null;
      }
      if (
        campaignProduct?.child_category_id &&
        campaignProduct?.child_category_id?.child_category_status !== "active"
      ) {
        return null;
      }
      if (
        campaignProduct?.brand_id &&
        campaignProduct?.brand_id?.brand_status !== "active"
      ) {
        return null;
      }

      const productData: any = {
        _id: campaignProduct?._id,
        product_name: campaignProduct?.product_name,
        product_slug: campaignProduct?.product_slug,
        main_image: campaignProduct?.main_image,
        brand_id: campaignProduct?.brand_id,
        is_variation: campaignProduct?.is_variation,
      };

      // Add `product_price` and `product_discount_price` if they exist
      if (campaignProduct?.product_price) {
        productData.product_price = campaignProduct?.product_price;
      }
      if (campaignProduct?.product_discount_price) {
        productData.product_discount_price =
          campaignProduct?.product_discount_price;
      }

      // Handle variations if `is_variation` is true
      if (campaignProduct?.is_variation) {
        const variation = await VariationModel.findOne({
          product_id: campaignProduct?._id,
        })
          .sort({ _id: -1 })
          .select(
            "-__v -variation_buying_price -variation_alert_quantity -variation_barcode -variation_barcode_image -variation_image_key -variation_sku -createdAt -updatedAt"
          ); // Sort if required

        if (variation) {
          productData.variations = variation;
        }
      }

      return {
        campaign_product_status: product?.campaign_product_status,
        campaign_product_price: product?.campaign_product_price,
        campaign_price_type: product?.campaign_price_type,
        campaign_product: productData,
      };
    })
  );

  // Convert to plain object
  const campaignObject = findCampaign.toObject();

  return {
    ...campaignObject,
    campaign_products: transformedCampaignProducts.filter(Boolean), // Remove null entries
  };
};

// Find all dashboard Campaign
export const findAllDashboardCampaignServices = async (
  limit: number,
  skip: number,
  searchTerm: any
): Promise<ICampaignInterface[] | []> => {
  const andCondition = [];
  if (searchTerm) {
    andCondition.push({
      $or: campaignSearchableField.map((field) => ({
        [field]: {
          $regex: searchTerm,
          $options: "i",
        },
      })),
    });
  }
  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};
  let findCampaign: ICampaignInterface[] | [] = await CampaignModel.find(
    whereCondition
  )
    .populate([
      {
        path: "campaign_products.campaign_product_id",
        model: "products",
        populate: {
          path: "brand_id",
          model: "brands",
        },
      },
    ])
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .select("-__v")
    .lean();

  // Check for products with is_variation = true and fetch variations
  const variationPromises = findCampaign?.map(async (campaign: any) => {
    const productsWithVariations = await Promise.all(
      campaign?.campaign_products?.map(async (product: any) => {
        if (product?.campaign_product_id?.is_variation) {
          // Fetch variations from VariationModel where product_id matches
          const variations = await VariationModel.find({
            product_id: product?.campaign_product_id?._id,
          });
          return {
            ...product,
            variations, // Attach variations to the product
          };
        }
        return product;
      })
    );

    return {
      ...campaign,
      campaign_products: productsWithVariations, // Update campaign_products with variations
    };
  });

  findCampaign = await Promise.all(variationPromises);

  return findCampaign;
};

// Find product for add Campaign
export const findProductToAddCampaignServices = async (
  limit: number,
  skip: number,
  searchTerm: any
): Promise<any[] | null> => {
  const andCondition: any[] = [
    { product_status: "active" },
    { product_campaign_id: { $exists: false } },
  ];

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

  const findProduct = await ProductModel.aggregate([
    { $match: { $and: andCondition } },
    {
      $lookup: {
        from: "categories",
        localField: "category_id",
        foreignField: "_id",
        as: "category_info",
      },
    },
    { $unwind: "$category_info" },
    {
      $lookup: {
        from: "subcategories",
        localField: "sub_category_id",
        foreignField: "_id",
        as: "subcategory_info",
      },
    },
    {
      $unwind: {
        path: "$subcategory_info",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "childcategories",
        localField: "child_category_id",
        foreignField: "_id",
        as: "childcategory_info",
      },
    },
    {
      $unwind: {
        path: "$childcategory_info",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "brands",
        localField: "brand_id",
        foreignField: "_id",
        as: "brand_info",
      },
    },
    {
      $unwind: {
        path: "$brand_info",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $match: {
        "category_info.category_status": "active",
        $and: [
          {
            $or: [
              { "subcategory_info.sub_category_status": "active" },
              { subcategory_info: { $exists: false } },
            ],
          },
          {
            $or: [
              { "childcategory_info.child_category_status": "active" },
              { childcategory_info: { $exists: false } },
            ],
          },
          {
            $or: [
              { "brand_info.brand_status": "active" },
              { brand_info: { $exists: false } },
            ],
          },
        ],
      },
    },
    // Join with VariationModel if is_variation is true
    {
      $lookup: {
        from: "variations",
        let: { productId: "$_id", isVariation: "$is_variation" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$product_id", "$$productId"] },
                  { $eq: ["$$isVariation", true] },
                ],
              },
            },
          },
        ],
        as: "variation_details",
      },
    },
    { $sort: { _id: -1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $project: {
        __v: 0,
        "category_info.__v": 0,
        "subcategory_info.__v": 0,
        "variation_details.__v": 0,
      },
    },
  ]);

  return findProduct;
};

// Update a Campaign
export const updateCampaignServices = async (
  data: ICampaignInterface,
  _id: string
): Promise<ICampaignInterface | any> => {
  const updateCampaignInfo: ICampaignInterface | null =
    await CampaignModel.findOne({
      _id: _id,
    });
  if (!updateCampaignInfo) {
    return {};
  }
  const Campaign = await CampaignModel.updateOne({ _id: _id }, data, {
    runValidators: true,
  });
  return Campaign;
};

// Delete a Campaign
export const deleteCampaignServices = async (
  _id: string,
  session: mongoose.ClientSession
): Promise<ICampaignInterface | any> => {
  const Campaign = await CampaignModel.deleteOne(
    { _id: _id },
    {
      session,
      runValidators: true,
    }
  );
  return Campaign;
};
