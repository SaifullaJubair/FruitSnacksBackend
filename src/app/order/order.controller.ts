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
import { recomputeOrderTotals } from "./order.recompute";
import {
  decrementStockForLines,
  restockOrder,
  bumpSoldCounts,
} from "./order.stock";
import { getCurrencyCode } from "../setting/setting.services";
import {
  initiatePayment,
  initiateAdvancePayment,
} from "../payment/payment.service";
import { markAbandonedCartRecoveredByPhone } from "../abandonedCart/abandonedCart.services";
import { earnOnOrder, redeemOnOrder } from "../loyalty/loyalty.services";
import { normalizeBdPhone } from "../../utils/phone";

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

  // B1 (2026-06-04) — normalize the inbound phone so guest-order auto-create
  // doesn't spin up a duplicate account when the same buyer returns with a
  // slightly different format. Look up against BOTH the normalized form AND
  // the raw form until the backfill script rewrites legacy docs.
  const rawPhone = requestData?.customer_phone;
  const normalizedPhone = normalizeBdPhone(rawPhone);
  requestData.customer_phone = normalizedPhone;

  const userCheck: any = await UserModel.findOne({
    $or: [
      { user_phone: normalizedPhone },
      { user_phone: rawPhone },
    ],
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

    // 🔒 Server-side recompute — client-sent prices/totals are NEVER trusted.
    // Overwrite the order totals + per-line prices with server-computed values.
    const recomputed = await recomputeOrderTotals(requestData, session);
    requestData.sub_total_amount = recomputed.sub_total_amount;
    requestData.discount_amount = recomputed.discount_amount;
    requestData.shipping_cost = recomputed.shipping_cost;
    requestData.vat_amount = recomputed.vat_amount; // Phase H
    requestData.grand_total_amount = recomputed.grand_total_amount;
    // Phase G3 (F1b) — persist the clamped redeem values on the order doc so
    // admin can see them in PaymentInfoCard + so reports can split discount
    // vs loyalty without spelunking the ledger.
    requestData.loyalty_redeem_points = recomputed.loyalty_redeem_points || 0;
    requestData.loyalty_redeem_amount = recomputed.loyalty_redeem_amount || 0;

    // Phase C3: when client requested a valid advance, force the order to
    // record itself as "cod" + advance_amount; the advance leg is charged
    // separately below (post-commit) via the requested advance gateway.
    if (recomputed.advance_amount && recomputed.advance_method) {
      requestData.payment_method = "cod";
      requestData.advance_amount = recomputed.advance_amount;
    }

    requestData.invoice_id = await generateInvoiceId();
    const result: any = await postOrderServices(requestData, session);
    if (!result) throw new ApiError(400, "Order Create Failed !");

    for (const line of recomputed.order_products) {
      const orderDetails = await OrderProductModel.create(
        [
          {
            order_id: result?._id,
            invoice_id: requestData.invoice_id,
            product_id: line?.product_id,
            variation_id: line?.variation_id,
            product_unit_price: line?.product_unit_price,
            product_unit_final_price: line?.product_unit_final_price,
            product_quantity: line?.product_quantity,
            product_grand_total_price: line?.product_grand_total_price,
            campaign_id: line?.campaign_id,
            product_main_price: line?.product_main_price,
            product_main_discount_price: line?.product_main_discount_price,
            customer_id: requestData?.customer_id,
            // Phase 1 — snapshot SKU + barcode at placement.
            product_sku_snapshot: line?.product_sku_snapshot,
            variation_sku_snapshot: line?.variation_sku_snapshot,
            product_barcode_snapshot: line?.product_barcode_snapshot,
            variation_barcode_snapshot: line?.variation_barcode_snapshot,
          },
        ],
        { session },
      );
      if (!orderDetails) throw new ApiError(400, "Order Create Failed!");
    }

    // 🔒 Decrement stock atomically at placement (guarded — never goes negative).
    await decrementStockForLines(recomputed.order_products, session);
    // 📈 Bump sold_count for social-proof / reporting (Phase F).
    await bumpSoldCounts(recomputed.order_products, session);
    // 🎁 Phase G3 (F1b): debit redeemed points (recompute clamped already).
    try {
      if (recomputed.loyalty_redeem_points) {
        await redeemOnOrder(
          requestData?.customer_id,
          recomputed.loyalty_redeem_points,
          requestData.invoice_id,
          session,
        );
      }
    } catch (_) {}
    // 🎁 Phase G3: auto-earn loyalty points (silent no-op if disabled).
    try {
      await earnOnOrder(
        requestData?.customer_id,
        recomputed.grand_total_amount,
        requestData.invoice_id,
        session,
      );
    } catch (_) {}

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
      const currency = await getCurrencyCode();

      // Phase 1B EMQ — split name, sum qty, pass form-derived geo.
      const nameParts = String(requestData?.customer_name || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      const fn = nameParts[0] || undefined;
      const ln = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;
      const numItems = Array.isArray(requestData?.order_products)
        ? requestData.order_products.reduce(
            (s: number, p: any) => s + (Number(p?.product_quantity) || 1),
            0,
          )
        : 0;

      await sendMetaEvent({
        event_name: "Purchase",
        event_id: requestData?.purchase_event_id || `purchase-${result?._id}`,
        event_source_url:
          req.headers?.referer || "https://fruitsnacksbd.com/cart",
        action_source: "website",
        user_data: {
          ph: requestData?.customer_phone,
          fn,
          ln,
          em: requestData?.customer_email,
          ct: requestData?.billing_city,
          st: requestData?.billing_state,
          country: "bd",
          external_id: requestData?.customer_id,
          client_ip_address: clientIp,
          client_user_agent: req.headers["user-agent"] || "",
          fbc: requestData?.fbc,
          fbp: requestData?.fbp,
        },
        custom_data: {
          currency,
          value: requestData?.grand_total_amount,
          content_ids: requestData?.order_products?.map(
            (p: any) => p?.product_id,
          ),
          content_type: "product",
          num_items: numItems,
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

    // ── Phase G2: mark any open abandoned-cart for this phone as recovered
    // (silent fail — recovery tracking is best-effort).
    try {
      await markAbandonedCartRecoveredByPhone(
        requestData?.customer_phone,
        result?._id,
      );
    } catch (_) {}

    // ── Phase C: hand off to the chosen payment gateway (post-commit so a
    // gateway hiccup doesn't roll back the order). For COD this is a no-op.
    // Phase C3: if an advance was requested, initiate the advance gateway for
    // ONLY the advance_amount (order itself stays cod for the rest).
    let payment_init: any = { kind: "none" };
    try {
      if (recomputed.advance_amount && recomputed.advance_method) {
        payment_init = await initiateAdvancePayment(
          { ...requestData, _id: result?._id },
          recomputed.advance_method,
          recomputed.advance_amount,
        );
      } else {
        payment_init = await initiatePayment({
          ...requestData,
          _id: result?._id,
        });
      }
    } catch (e: any) {
      payment_init = { kind: "none", error: e?.message || "init failed" };
    }

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Order Create Successfully !",
      data: {
        order_id: result?._id,
        invoice_id: requestData?.invoice_id,
        user_created: requestData?.user_created ?? false,
        payment_method: requestData?.payment_method || "cod",
        payment_init,
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

    // 🔒 Server-side recompute — client-sent prices/totals are NEVER trusted.
    const recomputed = await recomputeOrderTotals(requestData, session);
    requestData.sub_total_amount = recomputed.sub_total_amount;
    requestData.discount_amount = recomputed.discount_amount;
    requestData.shipping_cost = recomputed.shipping_cost;
    requestData.vat_amount = recomputed.vat_amount; // Phase H
    requestData.grand_total_amount = recomputed.grand_total_amount;
    // Phase G3 (F1b) — persist the clamped redeem values on the order doc so
    // admin can see them in PaymentInfoCard + so reports can split discount
    // vs loyalty without spelunking the ledger.
    requestData.loyalty_redeem_points = recomputed.loyalty_redeem_points || 0;
    requestData.loyalty_redeem_amount = recomputed.loyalty_redeem_amount || 0;

    requestData.invoice_id = await generateInvoiceId();
    const result: any = await postOrderServices(requestData, session);
    if (!result) throw new ApiError(400, "Order Create Failed !");

    for (const line of recomputed.order_products) {
      const orderDetails = await OrderProductModel.create(
        [
          {
            order_id: result?._id,
            invoice_id: requestData.invoice_id,
            product_id: line?.product_id,
            variation_id: line?.variation_id,
            product_unit_price: line?.product_unit_price,
            product_unit_final_price: line?.product_unit_final_price,
            product_quantity: line?.product_quantity,
            product_grand_total_price: line?.product_grand_total_price,
            campaign_id: line?.campaign_id,
            product_main_price: line?.product_main_price,
            product_main_discount_price: line?.product_main_discount_price,
            customer_id: requestData?.customer_id,
            // Phase 1 — snapshot SKU + barcode at placement.
            product_sku_snapshot: line?.product_sku_snapshot,
            variation_sku_snapshot: line?.variation_sku_snapshot,
            product_barcode_snapshot: line?.product_barcode_snapshot,
            variation_barcode_snapshot: line?.variation_barcode_snapshot,
          },
        ],
        { session },
      );
      if (!orderDetails) throw new ApiError(400, "Order Create Failed!");
    }

    // 🔒 Decrement stock atomically at placement (guarded — never goes negative).
    await decrementStockForLines(recomputed.order_products, session);
    // 📈 Bump sold_count for social-proof / reporting (Phase F).
    await bumpSoldCounts(recomputed.order_products, session);
    // 🎁 Phase G3 (F1b): debit redeemed points (recompute clamped already).
    try {
      if (recomputed.loyalty_redeem_points) {
        await redeemOnOrder(
          requestData?.customer_id,
          recomputed.loyalty_redeem_points,
          requestData.invoice_id,
          session,
        );
      }
    } catch (_) {}
    // 🎁 Phase G3: auto-earn loyalty points (silent no-op if disabled).
    try {
      await earnOnOrder(
        requestData?.customer_id,
        recomputed.grand_total_amount,
        requestData.invoice_id,
        session,
      );
    } catch (_) {}

    await handleCouponUsage(requestData, session);

    await session.commitTransaction();
    session.endSession();

    // ── Meta Purchase event (silent fail) ────────────────────────────────────
    try {
      const clientIp =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        "";
      const currency = await getCurrencyCode();

      // Phase 1B EMQ — split name, sum qty, pass form-derived geo.
      const nameParts = String(requestData?.customer_name || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      const fn = nameParts[0] || undefined;
      const ln = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;
      const numItems = Array.isArray(requestData?.order_products)
        ? requestData.order_products.reduce(
            (s: number, p: any) => s + (Number(p?.product_quantity) || 1),
            0,
          )
        : 0;

      await sendMetaEvent({
        event_name: "Purchase",
        event_id: requestData?.purchase_event_id || `purchase-${result?._id}`,
        event_source_url: req.headers?.referer || "https://fruitsnacksbd.com",
        action_source: "website",
        user_data: {
          ph: requestData?.customer_phone,
          fn,
          ln,
          em: requestData?.customer_email,
          ct: requestData?.billing_city,
          st: requestData?.billing_state,
          country: "bd",
          external_id: requestData?.customer_id,
          client_ip_address: clientIp,
          client_user_agent: req.headers["user-agent"] || "",
          fbc: requestData?.fbc,
          fbp: requestData?.fbp,
        },
        custom_data: {
          currency,
          value: requestData?.grand_total_amount,
          content_ids: requestData?.order_products?.map(
            (p: any) => p?.product_id,
          ),
          content_type: "product",
          num_items: numItems,
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

    // ── Phase G2: mark any open abandoned-cart for this phone as recovered
    // (silent fail — recovery tracking is best-effort).
    try {
      await markAbandonedCartRecoveredByPhone(
        requestData?.customer_phone,
        result?._id,
      );
    } catch (_) {}

    // ── Phase C: hand off to the chosen payment gateway (post-commit so a
    // gateway hiccup doesn't roll back the order). For COD this is a no-op.
    // Phase C3: if an advance was requested, initiate the advance gateway for
    // ONLY the advance_amount (order itself stays cod for the rest).
    let payment_init: any = { kind: "none" };
    try {
      if (recomputed.advance_amount && recomputed.advance_method) {
        payment_init = await initiateAdvancePayment(
          { ...requestData, _id: result?._id },
          recomputed.advance_method,
          recomputed.advance_amount,
        );
      } else {
        payment_init = await initiatePayment({
          ...requestData,
          _id: result?._id,
        });
      }
    } catch (e: any) {
      payment_init = { kind: "none", error: e?.message || "init failed" };
    }

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Order Create Successfully !",
      data: {
        order_id: result?._id,
        invoice_id: requestData?.invoice_id,
        user_created: requestData?.user_created ?? false,
        payment_method: requestData?.payment_method || "cod",
        payment_init,
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

    // Restock cancelled order (idempotent).
    await restockOrder(order_id, session);

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

    // Stock is decremented at PLACEMENT (B2), not at delivery. On cancel/return
    // we add it back (idempotent via order.stock_restored).
    if (
      requestData?.order_status === "cancel" ||
      requestData?.order_status === "return"
    ) {
      await restockOrder(requestData?._id, session);
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

// ===============================================================
// PATCH Update Order Delivery Info
// ================================================================

export const updateOrderDeliveryInfo: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { order_id } = req.params;
    const {
      delivery_name,
      delivery_phone,
      delivery_alt_phone,
      delivery_address,
      delivery_note,
    } = req.body;

    // শুধু delivery fields update করব — order_status বা অন্য কিছু না
    const updateData: any = {};
    if (delivery_name !== undefined) updateData.delivery_name = delivery_name;
    if (delivery_phone !== undefined)
      updateData.delivery_phone = delivery_phone;
    if (delivery_alt_phone !== undefined)
      updateData.delivery_alt_phone = delivery_alt_phone;
    if (delivery_address !== undefined)
      updateData.delivery_address = delivery_address;
    if (delivery_note !== undefined) updateData.delivery_note = delivery_note;

    if (Object.keys(updateData).length === 0) {
      throw new ApiError(400, "No delivery fields provided to update");
    }

    updateData.order_updated_by = (req as any).userId;

    const result = await OrderModel.updateOne(
      { _id: order_id },
      { $set: updateData },
      { runValidators: true },
    );

    if (result.matchedCount === 0) throw new ApiError(404, "Order Not Found!");
    // if (result.modifiedCount === 0)
    // throw new ApiError(400, "Delivery Info Update Failed!");

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Delivery Info Updated Successfully!",
    });
  } catch (error) {
    next(error);
  }
};

// S4+S5 Phase 1C — opt-in email collection from the post-order
// success-page prompt. Public (no auth) — same security model as
// the order_id-in-URL details endpoint that already exists.
//
// Single-use: rejects overwrite if customer_email already set, so
// someone who guesses an order_id can't replace the real buyer's
// email later. Returns 200 silently when the email matches what's
// already stored (idempotent retry on flaky network).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const setOrderEmail: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { order_id } = req.params;
    const raw = (req.body?.customer_email || "").trim().toLowerCase();
    if (!raw || !EMAIL_RE.test(raw)) {
      throw new ApiError(400, "Please provide a valid email address.");
    }
    const order: any = await OrderModel.findById(order_id).select(
      "customer_email customer_id",
    );
    if (!order) throw new ApiError(404, "Order not found.");

    if (order.customer_email && order.customer_email !== raw) {
      throw new ApiError(
        409,
        "Email already set on this order; cannot be changed.",
      );
    }

    if (order.customer_email === raw) {
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Email already saved.",
        data: { customer_email: raw },
      });
    }

    await OrderModel.updateOne(
      { _id: order_id },
      { $set: { customer_email: raw } },
    );
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Email saved for this order.",
      data: { customer_email: raw },
    });
  } catch (error) {
    next(error);
  }
};
