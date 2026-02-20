import { NextFunction, Request, RequestHandler, Response } from "express";
import mongoose from "mongoose";
import httpStatus from "http-status";
import {
  getSteadfastBalanceService,
  sendOrderToSteadfastService,
  trackSteadfastOrderService,
} from "./steadfast.service";
import sendResponse from "../../shared/sendResponse";
import {
  sendOrderToPathaoService,
  trackPathaoOrderService,
} from "./pathao.service";

// ===================== STEADFAST =====================

// Steadfast এ order পাঠাও
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

// Steadfast order track করো
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

// Steadfast balance check
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

// Pathao তে order পাঠাও
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

// Pathao order track করো
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
