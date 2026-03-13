import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import ApiError from "../../errors/ApiError";
import { IOrderInterface, orderSearchableField } from "./order.interface";
import httpStatus from "http-status";
import {
  getACustomerAllOrderServices,
  getAOrderWithOrderProductsServices,
  getDashboardOrderServices,
  getSteadfastOrderServices,
  getPathaoOrderServices,
  getOrderTrackingInfoService,
  postOrderServices,
  updateOrderServices,
} from "./order.service";
import OrderProductModel from "../orderProducts/orderProduct.model";
import ProductModel from "../product/product.model";
import VariationModel from "../variation/variation.model";
import OrderModel from "./order.model";
import CouponUsedModel from "../coupon/coupon_used/coupon.used.model";
import { createCouponUsedCustomer } from "../coupon/coupon_used/coupon.used.services";
import CouponModel from "../coupon/coupon.model";
import { IUserInterface } from "../user/user.interface";
import { postSingleOrderUserServices } from "../user/user.services";
import UserModel from "../user/user.model";
import mongoose from "mongoose";
import { sendMetaEvent } from "../metaPixel/meta.pixel.service";
import {
  sendOrderSMS_GuestUnverified,
  sendOrderSMS_LoggedIn,
  sendOrderSMS_VerifiedGuest,
} from "../../utils/send.order.sms";

const bcrypt = require("bcryptjs");
const saltRounds = 10;

// ================================================================
// Generate Unique Invoice ID
// ================================================================
export const generateInvoiceId = async (): Promise<string> => {
  let isUnique = false;
  let uniqueInvoiceId = "";
  while (!isUnique) {
    uniqueInvoiceId = Array.from({ length: 6 }, () =>
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".charAt(
        Math.floor(Math.random() * 36),
      ),
    ).join("");
    const existing = await OrderModel.findOne({ invoice_id: uniqueInvoiceId });
    if (!existing) isUnique = true;
  }
  return uniqueInvoiceId;
};

// ================================================================
// Helper: Create or Find User for Guest Orders
// ================================================================
const findOrCreateUser = async (
  requestData: any,
  session: mongoose.ClientSession,
) => {
  if (!requestData?.need_user_create) {
    // ✅ Logged in user — DB থেকে user_verified নিয়ে আসো
    const loggedInUser: any = await UserModel.findOne({
      _id: requestData?.customer_id,
    }).session(session);
    requestData.user_verified = loggedInUser?.user_verified ?? false;
    requestData.user_created = false;
    return;
  }

  const userCheck: any = await UserModel.findOne({
    user_phone: requestData?.customer_phone,
  }).session(session);

  if (userCheck) {
    requestData.customer_id = userCheck?._id?.toString();
    requestData.user_created = false;
    requestData.user_verified = userCheck?.user_verified ?? false; // ✅
    return;
  }

  const userCreateData: any = {
    user_name: requestData?.customer_name || requestData?.user_name,
    user_phone: requestData?.customer_phone,
    user_country: requestData?.billing_country,
    user_division: requestData?.billing_state,
    user_district: requestData?.billing_city,
    user_address: requestData?.billing_address,
    user_status: "active",
    wallet_amount: 0,
    user_type: "guest",
    user_verified: false,
  };

  if (requestData?.user_password) {
    userCreateData.user_password = await new Promise<string>(
      (resolve, reject) => {
        bcrypt.hash(
          requestData.user_password,
          saltRounds,
          (err: any, hash: any) => {
            if (err) reject(err);
            else resolve(hash);
          },
        );
      },
    );
    userCreateData.user_verified = true;
    userCreateData.user_type = "registered";
  }

  const result: IUserInterface | any = await postSingleOrderUserServices(
    userCreateData,
    session,
  );
  if (!result) throw new ApiError(400, "User Added Failed !");

  requestData.customer_id = result?._id?.toString();
  requestData.user_created = true;
  requestData.user_verified = userCreateData.user_verified; // ✅
};

// ================================================================
// Helper: Handle Coupon Usage
// ================================================================
const handleCouponUsage = async (
  requestData: any,
  session: mongoose.ClientSession,
) => {
  if (!requestData?.coupon_id) return;

  const checkCouponIsUsed = await CouponUsedModel.findOne({
    coupon_id: requestData?.coupon_id,
    customer_id: requestData?.customer_id,
  }).session(session);

  if (!checkCouponIsUsed) {
    const createCouponUsed = await createCouponUsedCustomer(
      {
        coupon_id: new mongoose.Types.ObjectId(
          requestData?.coupon_id.toString(),
        ),
        customer_id: new mongoose.Types.ObjectId(
          requestData?.customer_id.toString(),
        ),
        used: 1,
      },
      session,
    );
    if (!createCouponUsed) throw new ApiError(400, "Order Create Failed!");
  } else {
    const couponUsedUpdate = await CouponUsedModel.updateOne(
      {
        coupon_id: requestData?.coupon_id,
        customer_id: requestData?.customer_id,
      },
      { $inc: { used: 1 } },
      { session, runValidators: true },
    );
    if (couponUsedUpdate.modifiedCount === 0)
      throw new ApiError(400, "Order Create Failed!");
  }

  const mainCouponUpdate = await CouponModel.updateOne(
    { _id: requestData?.coupon_id },
    { $inc: { coupon_available: -1 } },
    { session, runValidators: true },
  );
  if (mainCouponUpdate.modifiedCount === 0)
    throw new ApiError(400, "Order Create Failed!");
};

// ================================================================
// POST Order (Main — Add to Cart)
// ================================================================
export const postOrder: any = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const requestData = req.body;
    await findOrCreateUser(requestData, session);

    requestData.invoice_id = await generateInvoiceId();
    const result: any = await postOrderServices(requestData, session);
    if (!result) throw new ApiError(400, "Order Create Failed !");

    for (const productDetails of requestData?.order_products || []) {
      const orderDetails = await OrderProductModel.create(
        [
          {
            order_id: result?._id,
            invoice_id: requestData.invoice_id,
            product_id: productDetails?.product_id,
            variation_id: productDetails?.variation_id,
            product_unit_price: productDetails?.product_unit_price,
            product_unit_final_price: productDetails?.product_unit_final_price,
            product_quantity: productDetails?.product_quantity,
            product_grand_total_price:
              productDetails?.product_grand_total_price,
            campaign_id: productDetails?.campaign_id,
            product_main_price: productDetails?.product_main_price,
            product_main_discount_price:
              productDetails?.product_main_discount_price,
            customer_id: requestData?.customer_id,
          },
        ],
        { session },
      );
      if (!orderDetails) throw new ApiError(400, "Order Create Failed!");
    }

    await handleCouponUsage(requestData, session);

    const userUpdate = await UserModel.updateOne(
      { _id: requestData?.customer_id },
      {
        $set: {
          user_country: requestData?.billing_country,
          user_division: requestData?.billing_city,
          user_district: requestData?.billing_state,
          user_address: requestData?.billing_address,
        },
      },
      { session, runValidators: true },
    );
    if (userUpdate.modifiedCount === 0)
      throw new ApiError(400, "Order Create Failed!");

    await session.commitTransaction();
    session.endSession();

    // ── Meta Purchase event (silent fail) ────────────────────────────────────
    try {
      const clientIp =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        "";

      await sendMetaEvent({
        event_name: "Purchase",
        event_id: requestData?.purchase_event_id || `purchase-${result?._id}`,
        event_source_url:
          req.headers?.referer || "https://artisenleather.com/cart",
        action_source: "website",
        user_data: {
          ph: requestData?.customer_phone,
          fn: requestData?.customer_name,
          external_id: requestData?.customer_id,
          client_ip_address: clientIp,
          client_user_agent: req.headers["user-agent"] || "",
          fbc: requestData?.fbc,
          fbp: requestData?.fbp,
        },
        custom_data: {
          currency: "BDT",
          value: requestData?.grand_total_amount,
          content_ids: requestData?.order_products?.map(
            (p: any) => p?.product_id,
          ),
          content_type: "product",
          num_items: requestData?.order_products?.length,
          order_id: result?._id?.toString(),
        },
      });
    } catch (_) {}

    // ── SMS (silent fail) ─────────────────────────────────────────────────────
    try {
      const phone = requestData?.customer_phone;
      const invoice_id = requestData?.invoice_id;
      const user_verified = requestData?.user_verified ?? false;
      // need_user_create=false মানে logged in user
      const is_logged_in = !requestData?.need_user_create;

      if (phone && invoice_id) {
        if (!user_verified) {
          // Case 1: Fresh guest OR returning unverified guest
          await sendOrderSMS_GuestUnverified(phone, invoice_id);
        } else if (user_verified && !is_logged_in) {
          // Case 2: Verified but placed order without logging in
          await sendOrderSMS_VerifiedGuest(phone, invoice_id, invoice_id);
        } else {
          // Case 3: Logged-in verified user
          await sendOrderSMS_LoggedIn(phone, invoice_id);
        }
      }
    } catch (_) {}

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Order Create Successfully !",
      data: {
        order_id: result?._id,
        invoice_id: requestData?.invoice_id,
        user_created: requestData?.user_created ?? false,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

// ================================================================
// POST Single Order
// ================================================================
export const postSingleOrder: any = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const requestData = req.body;
    await findOrCreateUser(requestData, session);

    requestData.invoice_id = await generateInvoiceId();
    const result: any = await postOrderServices(requestData, session);
    if (!result) throw new ApiError(400, "Order Create Failed !");

    for (const productDetails of requestData?.order_products || []) {
      const orderDetails = await OrderProductModel.create(
        [
          {
            order_id: result?._id,
            invoice_id: requestData.invoice_id,
            product_id: productDetails?.product_id,
            variation_id: productDetails?.variation_id,
            product_unit_price: productDetails?.product_unit_price,
            product_unit_final_price: productDetails?.product_unit_final_price,
            product_quantity: productDetails?.product_quantity,
            product_grand_total_price:
              productDetails?.product_grand_total_price,
            campaign_id: productDetails?.campaign_id,
            product_main_price: productDetails?.product_main_price,
            product_main_discount_price:
              productDetails?.product_main_discount_price,
            customer_id: requestData?.customer_id,
          },
        ],
        { session },
      );
      if (!orderDetails) throw new ApiError(400, "Order Create Failed!");
    }

    await handleCouponUsage(requestData, session);

    await session.commitTransaction();
    session.endSession();

    // ── Meta Purchase event (silent fail) ────────────────────────────────────
    try {
      const clientIp =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        "";

      await sendMetaEvent({
        event_name: "Purchase",
        event_id: requestData?.purchase_event_id || `purchase-${result?._id}`,
        event_source_url: req.headers?.referer || "https://artisenleather.com",
        action_source: "website",
        user_data: {
          ph: requestData?.customer_phone,
          fn: requestData?.customer_name,
          external_id: requestData?.customer_id,
          client_ip_address: clientIp,
          client_user_agent: req.headers["user-agent"] || "",
          fbc: requestData?.fbc,
          fbp: requestData?.fbp,
        },
        custom_data: {
          currency: "BDT",
          value: requestData?.grand_total_amount,
          content_ids: requestData?.order_products?.map(
            (p: any) => p?.product_id,
          ),
          content_type: "product",
          num_items: requestData?.order_products?.length,
          order_id: result?._id?.toString(),
        },
      });
    } catch (_) {}

    // ── SMS (silent fail) ─────────────────────────────────────────────────────
    try {
      const phone = requestData?.customer_phone;
      const invoice_id = requestData?.invoice_id;
      const user_verified = requestData?.user_verified ?? false;
      // need_user_create=false মানে logged in user
      const is_logged_in = !requestData?.need_user_create;

      if (phone && invoice_id) {
        if (!user_verified) {
          // Case 1: Fresh guest OR returning unverified guest
          await sendOrderSMS_GuestUnverified(phone, invoice_id);
        } else if (user_verified && !is_logged_in) {
          // Case 2: Verified but placed order without logging in
          await sendOrderSMS_VerifiedGuest(phone, invoice_id, invoice_id);
        } else {
          // Case 3: Logged-in verified user
          await sendOrderSMS_LoggedIn(phone, invoice_id);
        }
      }
    } catch (_) {}

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Order Create Successfully !",
      data: {
        order_id: result?._id,
        invoice_id: requestData?.invoice_id,
        user_created: requestData?.user_created ?? false,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

// ================================================================
// GET Order Tracking Info
// ================================================================
export const getOrderTrackingInfo = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { order_id } = req.body;
    if (!order_id) throw new ApiError(400, "Must submit order id !");
    const result = await getOrderTrackingInfoService(order_id);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Order get successfully !",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// GET A Customer All Orders
// ================================================================
export const getACustomerAllOrder: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { page, limit, searchTerm, customer_id }: any = req.query;
    if (!customer_id) throw new ApiError(400, "Customer id is required");
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const result = await getACustomerAllOrderServices(
      limitNumber,
      skip,
      searchTerm,
      customer_id,
    );

    const andCondition: any[] = [{ customer_id }];
    if (searchTerm) {
      andCondition.push({
        $or: orderSearchableField?.map((field) => ({
          [field]: { $regex: searchTerm, $options: "i" },
        })),
      });
    }
    const total = await OrderModel.countDocuments({ $and: andCondition });

    return sendResponse<IOrderInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Order Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// GET Dashboard Orders
// ================================================================
export const getDashboardOrder: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { page, limit, searchTerm, order_status }: any = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const result = await getDashboardOrderServices(
      limitNumber,
      skip,
      searchTerm,
      order_status,
    );

    const andCondition: any[] = [];
    if (searchTerm) {
      andCondition.push({
        $or: orderSearchableField?.map((field) => ({
          [field]: { $regex: searchTerm, $options: "i" },
        })),
      });
    }
    if (
      order_status &&
      order_status !== "undefined" &&
      order_status !== "null"
    ) {
      andCondition.push({ order_status });
    }
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await OrderModel.countDocuments(whereCondition);

    return sendResponse<IOrderInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Order Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// GET Steadfast Orders
// ================================================================
export const getSteadfastOrders: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { page, limit, searchTerm, steadfast_status }: any = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const result = await getSteadfastOrderServices(
      limitNumber,
      skip,
      searchTerm,
      steadfast_status,
    );

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
    const total = await OrderModel.countDocuments({ $and: andCondition });

    return sendResponse<IOrderInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Steadfast Orders Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// ✅ GET Pathao Orders
// ================================================================
export const getPathaoOrders: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { page, limit, searchTerm, pathao_status }: any = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const result = await getPathaoOrderServices(
      limitNumber,
      skip,
      searchTerm,
      pathao_status,
    );

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
    const total = await OrderModel.countDocuments({ $and: andCondition });

    return sendResponse<IOrderInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Pathao Orders Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// PATCH Cancel Steadfast Order
// ================================================================
export const cancelSteadfastOrder: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { order_id } = req.params;
    const order: any = await OrderModel.findById(order_id).session(session);
    if (!order) throw new ApiError(404, "Order Not Found!");

    if (order.courier_type === "steadfast") {
      const blockList = [
        "delivered_approval_pending",
        "partial_delivered_approval_pending",
        "cancelled_approval_pending",
        "unknown_approval_pending",
        "delivered",
        "partial_delivered",
        "cancelled",
        "unknown",
        "hold",
      ];
      if (blockList.includes(order.steadfast_status)) {
        throw new ApiError(
          400,
          "Cannot cancel! Order is already processed by Steadfast.",
        );
      }
    }

    const cancelTime =
      new Date().toISOString().split("T")[0] +
      " " +
      new Date().toLocaleTimeString();

    const result = await OrderModel.updateOne(
      { _id: order_id },
      {
        order_status: "cancel",
        steadfast_status:
          order.courier_type === "steadfast"
            ? "cancelled"
            : order.steadfast_status,
        cancel_time: cancelTime,
        order_updated_by: (req as any).userId,
      },
      { session, runValidators: true },
    );

    if (result.modifiedCount === 0)
      throw new ApiError(400, "Order Cancel Failed!");

    await session.commitTransaction();
    session.endSession();

    const message =
      order.steadfast_status === "pending"
        ? "Order Cancelled! Please also cancel manually from Steadfast portal."
        : "Order Cancelled Successfully!";

    return sendResponse<IOrderInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

// ================================================================
// GET A Order Details With Order Products
// ================================================================
export const getAOrderWithOrderProducts: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<IOrderInterface | any> => {
  try {
    const { order_id }: any = req.params;
    const result: IOrderInterface | any =
      await getAOrderWithOrderProductsServices(order_id);
    return sendResponse<IOrderInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Order Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// ================================================================
// PATCH Update Order
// ================================================================
export const updateOrder: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const requestData = req.body;
    const timeNow =
      new Date().toISOString().split("T")[0] +
      " " +
      new Date().toLocaleTimeString();

    if (requestData?.order_status === "processing")
      requestData.processing_time = timeNow;
    if (requestData?.order_status === "shipped")
      requestData.shipped_time = timeNow;
    if (requestData?.order_status === "delivered")
      requestData.delivered_time = timeNow;
    if (requestData?.order_status === "cancel")
      requestData.cancel_time = timeNow;
    if (requestData?.order_status === "return")
      requestData.return_time = timeNow;

    const result: any = await updateOrderServices(
      requestData,
      requestData?._id,
      session,
    );
    if (result?.modifiedCount === 0)
      throw new ApiError(400, "Order Update Failed !");

    if (requestData?.order_status === "delivered") {
      const { order_products } = requestData;
      for (const order_product of order_products || []) {
        if (!order_product?.variation_id) {
          const productUpdate = await ProductModel.updateOne(
            { _id: order_product?.product_id },
            { $inc: { product_quantity: -order_product?.product_quantity } },
            { session, runValidators: true },
          );
          if (productUpdate.modifiedCount === 0)
            throw new ApiError(400, "Order Update Failed!");
        } else {
          const variationUpdate = await VariationModel.updateOne(
            {
              _id: order_product?.variation_id,
              product_id: order_product?.product_id,
            },
            { $inc: { variation_quantity: -order_product?.product_quantity } },
            { session, runValidators: true },
          );
          if (variationUpdate.modifiedCount === 0)
            throw new ApiError(400, "Order Update Failed!");
        }
      }
    }

    await session.commitTransaction();
    session.endSession();
    return sendResponse<IOrderInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Order Update Successfully !",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};
