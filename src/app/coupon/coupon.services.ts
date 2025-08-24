import { Types } from "mongoose";
import { ICouponInterface, couponSearchableField } from "./coupon.interface";
import CouponModel from "./coupon.model";
import UserModel from "../user/user.model";
import { productSearchableField } from "../product/product.interface";
import ProductModel from "../product/product.model";
import { IUserInterface } from "../user/user.interface";
import VariationModel from "../variation/variation.model";
import ApiError from "../../errors/ApiError";

// Create A Coupon
export const postCouponServices = async (
  data: ICouponInterface
): Promise<ICouponInterface | {}> => {
  const createCoupon: ICouponInterface | {} = await CouponModel.create(data);
  return createCoupon;
};

// Find A Coupon
export const findACouponServices = async (
  coupon_code: string
): Promise<ICouponInterface | {}> => {
  const findCoupon: ICouponInterface | {} | any = await CouponModel.findOne({
    coupon_code: coupon_code,
    coupon_status: "active",
  }).select("-__v");
  return findCoupon;
};

// Find all dashboard Coupon
export const findAllDashboardCouponServices = async (
  limit: number,
  skip: number,
  searchTerm: any
): Promise<ICouponInterface[] | []> => {
  const andCondition = [];
  if (searchTerm) {
    andCondition.push({
      $or: couponSearchableField.map((field) => ({
        [field]: { $regex: searchTerm, $options: "i" },
      })),
    });
  }

  const whereCondition: any =
    andCondition.length > 0 ? { $and: andCondition } : {};

  // Build the base query
  let query = CouponModel.find(whereCondition)
    .populate(["coupon_publisher_id", "coupon_updated_by"])
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .select("-__v");

  // Execute the initial query
  let findCoupon = await query.lean();

  // Conditionally populate specific fields for customers and products
  if (findCoupon?.length > 0) {
    const populatedCoupons = await Promise.all(
      findCoupon?.map(async (coupon: any) => {
        if (coupon?.coupon_customer_type === "specific") {
          coupon = await CouponModel.populate(coupon, {
            path: "coupon_specific_customer.customer_id",
            model: "users",
            select: "user_name user_phone user_status",
          });
        }

        if (coupon?.coupon_product_type === "specific") {
          coupon = await CouponModel.populate(coupon, {
            path: "coupon_specific_product.product_id",
            model: "products",
            select:
              "product_name product_status product_price product_discount_price product_quantity is_variation main_image",
          });

          // Iterate over coupon_specific_product array
          if (coupon?.coupon_specific_product?.length > 0) {
            coupon.coupon_specific_product = await Promise.all(
              coupon?.coupon_specific_product?.map(async (specificProduct: any) => {
                if (specificProduct?.product_id?.is_variation) {
                  const variations = await VariationModel.find({
                    product_id: specificProduct?.product_id?._id?.toString(),
                  }).select(
                    "variation_name variation_price variation_discount_price variation_quantity variation_image"
                  );

                  // Ensure variations are added to a new object
                  specificProduct = {
                    ...specificProduct,
                    variationDetails: variations, // Attach variations
                    // product_id: {
                    //   ...specificProduct?.product_id,
                    // },
                  };
                }
                return specificProduct;
              })
            );
          }
        }

        return coupon;
      })
    );

    findCoupon = populatedCoupons;
  }

  return findCoupon;
};

// Find all specific user for add coupon
export const findAllSpecificUserCouponServices = async (
  limit: number,
  skip: number,
  searchTerm: any
): Promise<IUserInterface[] | []> => {
  const andCondition: any[] = [];
  if (searchTerm) {
    andCondition.push({
      $or: couponSearchableField.map((field) => ({
        [field]: { $regex: searchTerm, $options: "i" },
      })),
    });
  }

  const whereCondition: any =
    andCondition.length > 0 ? { $and: andCondition } : {};

  const findUser = await UserModel.find(whereCondition)
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .select("-__v");
  return findUser;
};

// Find all specific Product for add coupon
export const findProductToAddCouponServices = async (
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

// Update a Coupon
export const updateCouponServices = async (
  data: ICouponInterface,
  _id: string,
  coupon_status: any
): Promise<ICouponInterface | any> => {
  const updateCouponInfo: ICouponInterface | null = await CouponModel.findOne({
    _id: _id,
  });
  if (!updateCouponInfo) {
    throw new ApiError(400, "Coupon not found");
  }
  const Coupon = await CouponModel.updateOne({ _id: _id }, {coupon_status: coupon_status}, {
    runValidators: true,
  });
  return Coupon;
};

// Delete a Coupon
export const deleteCouponServices = async (
  _id: string
): Promise<ICouponInterface | any> => {
  const Coupon = await CouponModel.deleteOne(
    { _id: _id },
    {
      runValidators: true,
    }
  );
  return Coupon;
};
