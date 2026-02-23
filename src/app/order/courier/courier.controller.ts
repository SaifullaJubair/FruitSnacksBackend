import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import httpStatus from "http-status";
import {
  bulkSendToSteadfastService,
  getSteadfastBalanceService,
  sendOrderToSteadfastService,
  syncSteadfastOrderService,
  trackSteadfastOrderService,
} from "../steadfast.service";
import {
  sendOrderToPathaoService,
  trackPathaoOrderService,
  syncPathaoOrderService,
  bulkSendToPathaoService,
  bulkSyncPathaoOrdersService,
  cancelPathaoOrderService,
} from "../pathao.service";
import sendResponse from "../../../shared/sendResponse";

// ===================== STEADFAST =====================

export const sendToSteadfast = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { order_id } = req.params;
    const result = await sendOrderToSteadfastService(order_id, session);
    await session.commitTransaction();
    session.endSession();
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Steadfast এ Order সফলভাবে পাঠানো হয়েছে!",
      data: result,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

export const bulkSendToSteadfast = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { order_ids } = req.body;
    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "order_ids array required" });
    }
    if (order_ids.length > 50) {
      return res.status(400).json({
        success: false,
        message: "একসাথে সর্বোচ্চ ৫০টা order পাঠানো যাবে।",
      });
    }
    const result = await bulkSendToSteadfastService(order_ids);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: `${result.success.length} টা সফল, ${result.failed.length} টা ব্যর্থ।`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const trackSteadfastOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { consignment_id } = req.params;
    const result = await trackSteadfastOrderService(consignment_id);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Steadfast Tracking Info",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const syncSteadfastOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { order_id } = req.params;
    const result = await syncSteadfastOrderService(order_id);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Steadfast status sync সফল!",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getSteadfastBalance = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await getSteadfastBalanceService();
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Steadfast Balance Info",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ===================== PATHAO =====================

export const sendToPathao = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { order_id } = req.params;
    const result = await sendOrderToPathaoService(order_id, session);
    await session.commitTransaction();
    session.endSession();
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Pathao তে Order সফলভাবে পাঠানো হয়েছে!",
      data: result,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

export const trackPathaoOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { consignment_id } = req.params;
    const result = await trackPathaoOrderService(consignment_id);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Pathao Tracking Info",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const syncPathaoOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { order_id } = req.params;
    const result = await syncPathaoOrderService(order_id);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Pathao status sync সফল!",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkSendToPathao = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { order_ids } = req.body;
    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "order_ids array required" });
    }
    if (order_ids.length > 50) {
      return res.status(400).json({
        success: false,
        message: "একসাথে সর্বোচ্চ ৫০টা order পাঠানো যাবে।",
      });
    }
    const result = await bulkSendToPathaoService(order_ids);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: `${result.success.length} টা সফল, ${result.failed.length} টা ব্যর্থ।`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkSyncPathaoOrders = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await bulkSyncPathaoOrdersService();
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: `✅ ${result.success.length} synced, ❌ ${result.failed.length} failed, ⏭️ ${result.skipped.length} skipped`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const cancelPathaoOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { order_id } = req.params;
    const result = await cancelPathaoOrderService(order_id);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Pathao Order Cancel সফল!",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
