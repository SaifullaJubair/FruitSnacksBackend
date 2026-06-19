import mongoose from "mongoose";
import { IOrderInterface, orderSearchableField } from "./order.interface";
import OrderModel from "./order.model";
import ApiError from "../../errors/ApiError";
import OrderProductModel from "../orderProducts/orderProduct.model";

// Create A Order
export const postOrderServices = async (
  data: IOrderInterface,
  session: mongoose.ClientSession,
): Promise<IOrderInterface | {} | any> => {
  const createOrder: IOrderInterface | {} | any = await OrderModel.create(
    [data],
    { session },
  );
  if (!createOrder) throw new ApiError(400, "Order Create Failed !");
  return createOrder?.[0];
};

// Get Order Tracking Info
export const getOrderTrackingInfoService = async (
  order_id: string,
): Promise<IOrderInterface | any> => {
  const order_info = await OrderModel.findOne({
    invoice_id: order_id,
  })
    .select("-internal_note") // Phase A — admin-only field, never on public tracking
    .populate([
      {
        path: "customer_id",
        model: "users",
        select: "user_name user_phone user_image",
      },
    ]);

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

// Get A Customer All Orders
export const getACustomerAllOrderServices = async (
  limit: number,
  skip: number,
  searchTerm: any,
  customer_id: any,
): Promise<any> => {
  try {
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: orderSearchableField?.map((field) => ({
          [field]: { $regex: searchTerm, $options: "i" },
        })),
      });
    }
    andCondition.push({ customer_id });
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};

    const getAllOrder = await OrderModel.find(whereCondition)
      .select("-internal_note") // Phase A — admin-only field, never on customer history
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

// Get Dashboard Orders (all order_status filter support)
export const getDashboardOrderServices = async (
  limit: number,
  skip: number,
  searchTerm: any,
  order_status: any,
  courier_type?: any,
  order_source?: any,
  order_type?: any,
): Promise<any> => {
  const andCondition: any[] = [];

  if (searchTerm) {
    andCondition.push({
      $or: orderSearchableField?.map((field) => ({
        [field]: { $regex: searchTerm, $options: "i" },
      })),
    });
  }

  if (order_status && order_status !== "undefined" && order_status !== "null") {
    andCondition.push({ order_status });
  }

  // ✅ courier_type filter (Pathao tab এর জন্য)
  if (courier_type && courier_type !== "undefined" && courier_type !== "null") {
    andCondition.push({ courier_type });
  }

  // D18 M3 — POS Orders tab: filter by order_source
  if (order_source && order_source !== "undefined" && order_source !== "null") {
    andCondition.push({ order_source });
  }

  // Order Unification Phase A — order_type filter (offer/regular/... chips)
  if (order_type && order_type !== "undefined" && order_type !== "null") {
    andCondition.push({ order_type });
  }

  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};

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

  return await Promise.all(
    getAllOrder?.map(async (order: any) => {
      const plainOrder = order?.toObject();
      const orderProduct = await OrderProductModel.find({
        order_id: plainOrder?._id?.toString(),
      }).select("product_id variation_id product_quantity");
      return { ...plainOrder, order_products: orderProduct };
    }),
  );
};

// Get Steadfast Orders
export const getSteadfastOrderServices = async (
  limit: number,
  skip: number,
  searchTerm: any,
  steadfast_status: any,
): Promise<any> => {
  const andCondition: any[] = [{ courier_type: "steadfast" }];

  if (searchTerm) {
    andCondition.push({
      $or: orderSearchableField?.map((field) => ({
        [field]: { $regex: searchTerm, $options: "i" },
      })),
    });
  }

  if (
    steadfast_status &&
    steadfast_status !== "undefined" &&
    steadfast_status !== "null" &&
    steadfast_status !== "all"
  ) {
    andCondition.push({ steadfast_status });
  }

  const whereCondition = { $and: andCondition };

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

  return await Promise.all(
    getAllOrder?.map(async (order: any) => {
      const plainOrder = order?.toObject();
      const orderProduct = await OrderProductModel.find({
        order_id: plainOrder?._id?.toString(),
      }).select("product_id variation_id product_quantity");
      return { ...plainOrder, order_products: orderProduct };
    }),
  );
};

// ✅ Get Pathao Orders
export const getPathaoOrderServices = async (
  limit: number,
  skip: number,
  searchTerm: any,
  pathao_status?: any,
): Promise<any> => {
  const andCondition: any[] = [{ courier_type: "pathao" }];

  if (searchTerm) {
    andCondition.push({
      $or: orderSearchableField?.map((field) => ({
        [field]: { $regex: searchTerm, $options: "i" },
      })),
    });
  }

  if (
    pathao_status &&
    pathao_status !== "undefined" &&
    pathao_status !== "null" &&
    pathao_status !== "all"
  ) {
    andCondition.push({ pathao_status });
  }

  const whereCondition = { $and: andCondition };

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

  return await Promise.all(
    getAllOrder?.map(async (order: any) => {
      const plainOrder = order?.toObject();
      const orderProduct = await OrderProductModel.find({
        order_id: plainOrder?._id?.toString(),
      }).select("product_id variation_id product_quantity");
      return { ...plainOrder, order_products: orderProduct };
    }),
  );
};

// Get A Order Details With Order Products
export const getAOrderWithOrderProductsServices = async (
  order_id: any,
): Promise<{ order: IOrderInterface; order_products: any[] } | null> => {
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

  if (!order) throw new ApiError(404, "Order not found");

  const orderProducts = await OrderProductModel.find({
    order_id: order?._id?.toString(),
  }).populate([
    {
      path: "product_id",
      model: "products",
      // product_sku / barcode / barcode_image surfaced for the admin order
      // details page (SKU column + "Print label" button per Phase D Bug #3).
      // Snapshots on the orderProduct doc are write-once at placement, but
      // the live product carries the printable barcode image URL.
      select:
        "product_name main_image product_sku barcode barcode_image barcode_format",
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
      select:
        "variation_name variation_image variation_sku variation_barcode variation_barcode_image variation_barcode_format",
    },
    { path: "campaign_id", model: "campaigns" },
  ]);

  const filteredOrderProducts = orderProducts?.map((product: any) => {
    if (product?.campaign_id) {
      const { campaign_products } = product?.campaign_id;
      const campaignDetails = campaign_products?.find(
        (cp: any) =>
          cp?.campaign_product_id.toString() ==
          product?.product_id?._id.toString(),
      );
      product.campaign_id = campaignDetails;
    }
    return product;
  });

  // Order Unification Phase A — this GET is public (`/:order_id`, used by the
  // invoice + success page with no auth). Strip the admin-only internal_note so
  // it never reaches a storefront customer. The admin order-detail page reads
  // internal_note from the dashboard list endpoint instead (admin-gated).
  const safeOrder: any = order ? (order as any).toObject?.() ?? order : order;
  if (safeOrder) delete safeOrder.internal_note;

  return { order: safeOrder, order_products: filteredOrderProducts };
};

// Update A Order
// A2.3 — allowed forward / terminal order-status transitions. The FE dropdown
// only offers these, but a crafted PATCH could otherwise jump pending→completed
// or revive a cancelled order; this is the server-side guard. Mirrors the
// (previously dead) OrderTable dropdown map.
const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["on_hold", "confirmed", "cancel"],
  on_hold: ["confirmed", "cancel"],
  confirmed: ["processing", "cancel"],
  processing: ["shipped", "cancel"],
  shipped: ["delivered", "return"],
  delivered: ["completed", "return"],
  // terminal — no onward transitions
  completed: [],
  cancel: [],
  return: [],
};

export const updateOrderServices = async (
  data: IOrderInterface,
  _id: string,
  session: mongoose.ClientSession,
): Promise<IOrderInterface | any> => {
  const updateOrderInfo = await OrderModel.findOne({ _id });
  if (!updateOrderInfo) throw new ApiError(400, "Order Not Found !");

  // Guard the status change (only when the PATCH actually changes order_status).
  const nextStatus = (data as any)?.order_status;
  const currentStatus = (updateOrderInfo as any)?.order_status;
  if (nextStatus && nextStatus !== currentStatus) {
    const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new ApiError(
        400,
        `Invalid order status change: "${currentStatus}" → "${nextStatus}".`,
      );
    }
  }

  return await OrderModel.updateOne({ _id }, data, {
    session,
    runValidators: true,
  });
};
