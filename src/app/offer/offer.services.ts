import { Types } from "mongoose";
import { productSearchableField } from "../product/product.interface";
import ProductModel from "../product/product.model";
import { IOfferInterface, offerSearchableField } from "./offer.interface";
import OfferModel from "./offer.model";
import VariationModel from "../variation/variation.model";
import ApiError from "../../errors/ApiError";

// Create A Offer
export const postOfferServices = async (
  data: IOfferInterface
): Promise<IOfferInterface | {}> => {
  const createOffer: IOfferInterface | {} = await OfferModel.create(data);
  return createOffer;
};

export const findAllOfferServices = async (): Promise<
  IOfferInterface[] | []
> => {
  const today = new Date();
  const todayStr = today.toISOString().substring(0, 10);

  const findOffer: IOfferInterface[] | [] = await OfferModel.find({
    offer_status: "active",
    offer_start_date: { $lte: todayStr },
    offer_end_date: { $gte: todayStr },
  })
    .populate({
      path: "offer_products.offer_product_id",
      model: "products",
      populate: {
        path: "brand_id",
        model: "brands",
      },
    })
    .sort({ _id: -1 })
    .select(
      "-__v -offer_products -offer_publisher_id -offer_updated_by -createdAt -updatedAt -offer_image_key"
    );

  const sendData: any = [];

  for (const offer of findOffer) {
    // Convert the Mongoose document to a plain JavaScript object
    const offerObj: any = offer.toObject();
    sendData.push(offerObj);
  }

  return sendData;
};

// Find A Offer
export const findAOfferServices = async (
  _id: string
): Promise<IOfferInterface | {}> => {
  const findOffer: IOfferInterface | {} | any = await OfferModel.findOne({
    $and: [{ offer_status: "active" }, { _id: _id }],
  })
    .populate({
      path: "offer_products.offer_product_id",
      model: "products",
      populate: {
        path: "brand_id",
        model: "brands",
        select: "_id brand_name",
      },
    })
    .sort({ _id: -1 })
    .select(
      "-__v -offer_image_key -offer_publisher_id -offer_updated_by -createdAt -updatedAt"
    );

  // Ensure `offer_products` exists and is an array
  const offerProducts = findOffer?.offer_products ?? [];
  if (!Array.isArray(offerProducts)) {
    throw new ApiError(400, "Invalid offer products data!");
  }

  // Transform `offer_products`
  const transformedOfferProducts = await Promise.all(
    offerProducts?.map(async (product: any) => {
      const offerProduct = product?.offer_product_id;

      if (!offerProduct) {
        return null;
      }

      const productData: any = {
        _id: offerProduct?._id,
        product_name: offerProduct?.product_name,
        product_slug: offerProduct?.product_slug,
        main_image: offerProduct?.main_image,
        brand_id: offerProduct?.brand_id,
        is_variation: offerProduct?.is_variation,
        attributes_details: offerProduct?.attributes_details,
      };

      // Add `product_price` and `product_discount_price` if they exist
      if (offerProduct?.product_price) {
        productData.product_price = offerProduct?.product_price;
      }
      if (offerProduct?.product_discount_price) {
        productData.product_discount_price =
          offerProduct?.product_discount_price;
      }

      // Handle variations if `is_variation` is true
      if (offerProduct?.is_variation) {
        const variation = await VariationModel.find({
          product_id: offerProduct?._id,
        }).select(
          "-__v -variation_buying_price -variation_alert_quantity -variation_barcode -variation_barcode_image -variation_image_key -variation_sku -createdAt -updatedAt"
        );

        if (variation) {
          productData.variation_details = variation;
        }
      }

      return {
        offer_product_quantity: product.offer_product_quantity,
        offer_discount_price: product.offer_discount_price,
        offer_discount_type: product.offer_discount_type,
        offer_product: productData,
      };
    })
  );

  // Convert to plain object
  const offerObject = findOffer.toObject();

  return {
    ...offerObject,
    offer_products: transformedOfferProducts.filter(Boolean),
  };
};

// Find product for add offer
export const findProductToAddOfferServices = async (
  limit: number,
  skip: number,
  searchTerm: any
): Promise<any[] | null> => {
  const andCondition: any[] = [{ product_status: "active" }];

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

// find all dashboard offer
export const findAllDashboardOfferServices = async (
  limit: number,
  skip: number,
  searchTerm: any
): Promise<IOfferInterface[] | []> => {
  const andCondition = [];
  if (searchTerm) {
    andCondition.push({
      $or: offerSearchableField.map((field) => ({
        [field]: {
          $regex: searchTerm,
          $options: "i",
        },
      })),
    });
  }
  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};
  let findOffer: IOfferInterface[] | [] = await OfferModel.find(whereCondition)
    .populate({
      path: "offer_products.offer_product_id",
      model: "products",
      populate: [
        {
          path: "brand_id",
          model: "brands",
        },
        {
          path: "category_id",
          model: "categories", // Use the appropriate model for categories
        },
      ],
    })
    .populate(["offer_publisher_id", "offer_updated_by"])
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .select("-__v")
    .lean();

  // Check for products with is_variation = true and fetch variations
  const variationPromises = findOffer?.map(async (offer: any) => {
    const productsWithVariations = await Promise.all(
      offer?.offer_products?.map(async (product: any) => {
        if (product?.offer_product_id?.is_variation) {
          // Fetch variations from VariationModel where product_id matches
          const variations = await VariationModel.find({
            product_id: product?.offer_product_id?._id,
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
      ...offer,
      offer_products: productsWithVariations, // Update offer_products with variations
    };
  });

  findOffer = await Promise.all(variationPromises);

  return findOffer;
};

// Update a Offer
export const updateOfferServices = async (
  data: IOfferInterface,
  _id: string
): Promise<IOfferInterface | any> => {
  const updateOfferInfo: IOfferInterface | null = await OfferModel.findOne({
    _id: _id,
  });
  if (!updateOfferInfo) {
    throw new ApiError(400, "Offer Not Found");
  }
  const Offer = await OfferModel.updateOne({ _id: _id }, data, {
    runValidators: true,
  });
  return Offer;
};

// Delete a Offer
export const deleteOfferServices = async (
  _id: string
): Promise<IOfferInterface | any> => {
  const Offer = await OfferModel.deleteOne(
    { _id: _id },
    {
      runValidators: true,
    }
  );
  return Offer;
};
