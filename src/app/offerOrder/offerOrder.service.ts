import mongoose from "mongoose";
import {
  IOfferOrderInterface,
  offerOrderSearchableField,
} from "./offerOrder.interface";
import OfferOrderModel from "./offerOrder.model";
import ApiError from "../../errors/ApiError";

// Create A OfferOrder
export const postOfferOrderServices = async (
  data: IOfferOrderInterface,
  session: mongoose.ClientSession
): Promise<IOfferOrderInterface | {} | any> => {
  const createOfferOrder: IOfferOrderInterface | {} | any =
    await OfferOrderModel.create([data], {
      session,
    });
  if (!createOfferOrder) throw new ApiError(400, "Order Create Failed !");
  const sendData: any = createOfferOrder?.[0];
  return sendData;
};

// Get a Customer all OfferOrder
export const getACustomerAllOfferOrderServices = async (
  limit: number,
  skip: number,
  searchTerm: any,
  customer_id: any
): Promise<any> => {
  try {
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: offerOrderSearchableField?.map((field) => ({
          [field]: {
            $regex: searchTerm,
            $options: "i",
          },
        })),
      });
    }
    andCondition.push({ customer_id });
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    // Fetch all OfferOrders for the given customer_id
    const getAllOfferOrder = await OfferOrderModel.find(whereCondition)
      .populate([
        {
          path: "offer_id",
          model: "offers",
          select: "-offer_products",
        },
      ])
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit);

    return getAllOfferOrder;
  } catch (error) {
    console.log(error);
    throw new Error("Could not fetch customer OfferOrders");
  }
};

// Get Dashboard OfferOrder
export const getDashboardOfferOrderServices = async (
  limit: number,
  skip: number,
  searchTerm: any
): Promise<any> => {
  try {
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: offerOrderSearchableField?.map((field) => ({
          [field]: {
            $regex: searchTerm,
            $options: "i",
          },
        })),
      });
    }
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    // Fetch all OfferOrders for the given customer_id
    const getAllOfferOrder = await OfferOrderModel.find(whereCondition)
      .populate([
        {
          path: "customer_id",
          model: "users",
          select: "-user_password -forgot_otp",
        },
        {
          path: "order_updated_by",
          model: "admins",
        },
        {
          path: "offer_id",
          model: "offers",
          select: "-offer_products",
        },
      ])
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit);

    return getAllOfferOrder;
  } catch (error) {
    console.log(error);
    throw new Error("Could not fetch customer OfferOrders");
  }
};

// Get A OfferOrder details with OfferOrder products
export const getAOfferOrderWithOfferOrderProductsServices = async (
  _id: any
): Promise<IOfferOrderInterface | null | any> => {
  // Fetch a single OfferOrder for the given _id
  const OfferOrder: any = await OfferOrderModel.findOne({
    _id: _id,
  }).populate([
    {
      path: "offer_products.offer_product_id",
      model: "products",
      select: "product_name main_image",
    },
    {
      path: "offer_products.variation_id",
      model: "variations",
      select: "variation_name variation_image",
    },
    {
      path: "customer_id",
      model: "users",
      select: "-user_password -forgot_otp",
    },
    {
      path: "offer_id",
      model: "offers",
      select: "-offer_products",
    },
  ]);

  if (!OfferOrder) {
    throw new Error("OfferOrder not found");
  }

  return OfferOrder;
};

// Update a OfferOrder
export const updateOfferOrderServices = async (
  data: IOfferOrderInterface,
  _id: string,
  session: mongoose.ClientSession
): Promise<IOfferOrderInterface | any> => {
  const updateOfferOrderInfo: IOfferOrderInterface | null =
    await OfferOrderModel.findOne({ _id: _id });
  if (!updateOfferOrderInfo) {
    throw new Error("OfferOrder not found");
  }
  const OfferOrder = await OfferOrderModel.updateOne({ _id: _id }, data, {
    session,
    runValidators: true,
  });
  return OfferOrder;
};
