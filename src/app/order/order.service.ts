import mongoose from "mongoose";
import { IOrderInterface, orderSearchableField } from "./order.interface";
import OrderModel from "./order.model";
import ApiError from "../../errors/ApiError";
import OrderProductModel from "../orderProducts/orderProduct.model";

// Create A Order
export const postOrderServices = async (
  data: IOrderInterface,
  session: mongoose.ClientSession
): Promise<IOrderInterface | {} | any> => {
  const createOrder: IOrderInterface | {} | any = await OrderModel.create(
    [data],
    {
      session,
    }
  );
  if (!createOrder) throw new ApiError(400, "Order Create Failed !");
  const sendData: any = createOrder?.[0];
  return sendData;
};

// get order Tracking info
export const getOrderTrackingInfoService = async (
  order_id: string
): Promise<IOrderInterface | any> => {
  const order_info = await OrderModel.findOne({
    invoice_id: order_id,
  }).populate([
    {
      path: "customer_id",
      model: "users",
      select: "user_name user_phone user_image",
    },
  ]);

  // Fetch products for the order
  const order_products = await OrderProductModel.find({
    order_id: order_info?._id?.toString(),
  }).populate([
    {
      path: "product_id",
      model: "products",
      select: "product_name main_image",
    },
    {
      path: "variation_id",
      model: "variations",
      select: "variation_name variation_image",
    },
  ]);

  return { order_info, order_products };
};

// Get a Customer all order
export const getACustomerAllOrderServices = async (
  limit: number,
  skip: number,
  searchTerm: any,
  customer_id: any
): Promise<any> => {
  try {
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: orderSearchableField?.map((field) => ({
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
    // Fetch all orders for the given customer_id
    const getAllOrder = await OrderModel.find(whereCondition)
      .populate("customer_id")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return getAllOrder;
  } catch (error) {
    console.log(error);
    throw new Error("Could not fetch customer orders");
  }
};

// Get Dashboard order
export const getDashboardOrderServices = async (
  limit: number,
  skip: number,
  searchTerm: any,
  order_status: any
): Promise<any> => {
  try {
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: orderSearchableField?.map((field) => ({
          [field]: {
            $regex: searchTerm,
            $options: "i",
          },
        })),
      });
    }
    if (
      order_status !== "" &&
      order_status !== undefined &&
      order_status !== null &&
      order_status !== "undefined" &&
      order_status !== "null"
    ) {
      andCondition.push({ order_status: order_status });
    }
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    // Fetch all orders for the given customer_id
    const getAllOrder = await OrderModel.find(whereCondition)
      .populate([
        {
          path: "customer_id",
          model: "users",
          select: "-user_password -user_otp",
        },
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const updatedOrders = await Promise.all(
      getAllOrder?.map(async (order: any) => {
        // Convert Mongoose document to plain JavaScript object
        const plainOrder = order?.toObject();

        // Fetch order products for each order
        const orderProduct = await OrderProductModel.find({
          order_id: plainOrder?._id?.toString(),
        }).select("product_id variation_id product_quantity");

        // Attach the order products to the order
        return {
          ...plainOrder,
          order_products: orderProduct,
        };
      })
    );

    return updatedOrders;
  } catch (error) {
    console.log(error);
    throw new Error("Could not fetch customer orders");
  }
};

// Get A order details with order products
export const getAOrderWithOrderProductsServices = async (
  order_id: any
): Promise<{ order: IOrderInterface; order_products: any[] } | null> => {
  try {
    // Fetch a single order for the given order_id
    const order = await OrderModel.findOne({ _id: order_id }).populate([
      {
        path: "customer_id",
        model: "users",
        select: "-user_password -user_otp",
      },
      {
        path: "coupon_id",
        model: "coupons",
        select:
          "coupon_code coupon_type coupon_amount coupon_max_amount coupon_customer_type coupon_product_type",
      },
    ]);

    if (!order) {
      throw new Error("Order not found");
    }

    // Fetch products for the order
    const orderProducts = await OrderProductModel.find({
      order_id: order?._id?.toString(),
    }).populate([
      {
        path: "product_id",
        model: "products",
        select: "product_name main_image",
        populate: [
          {
            path: "category_id",
            model: "categories",
            select: "category_name category_slug category_status",
          },
        ],
      },
      {
        path: "variation_id",
        model: "variations",
        select: "variation_name variation_image",
      },
      {
        path: "campaign_id",
        model: "campaigns",
      },
    ]);

    // Filter campaign products where campaign_product_id matches product_id
    const filteredOrderProducts = orderProducts?.map((product: any) => {
      if (product?.campaign_id) {
        const { campaign_products } = product?.campaign_id;
        const campaignDetails = campaign_products?.find(
          (campaignProduct: any) =>
            campaignProduct?.campaign_product_id.toString() ==
            product?.product_id?._id.toString()
        );
        product.campaign_id = campaignDetails;
      }
      return product;
    });

    return { order, order_products: filteredOrderProducts };
  } catch (error) {
    console.error(error);
    throw new Error("Could not fetch customer order details");
  }
};

// Update a Order
export const updateOrderServices = async (
  data: IOrderInterface,
  _id: string,
  session: mongoose.ClientSession
): Promise<IOrderInterface | any> => {
  const updateOrderInfo: IOrderInterface | null = await OrderModel.findOne({
    _id: _id,
  });
  if (!updateOrderInfo) {
    throw new ApiError(400, "Order Not Found !");
  }
  const Order = await OrderModel.updateOne({ _id: _id }, data, {
    session,
    runValidators: true,
  });
  return Order;
};
