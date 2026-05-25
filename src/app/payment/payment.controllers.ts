/**
 * payment.controllers.ts — HTTP handlers for Phase C payment endpoints.
 * Logic lives in payment.service.ts; these just unwrap req/res.
 */

import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import sendResponse from "../../shared/sendResponse";
import { submitTransaction, verifyPayment } from "./payment.service";

// Customer submits trxId after sending money via manual MFS.
export const submitOrderPayment: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { order_id } = req.params;
    const result = await submitTransaction(order_id, req.body || {});
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Payment submitted. Awaiting admin verification.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Admin marks the payment as paid OR failed (failed → cancel + restock).
export const verifyOrderPayment: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { order_id } = req.params;
    const admin_id = (req as any).userId;
    const result = await verifyPayment(order_id, req.body || {}, admin_id);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message:
        result.decision === "paid"
          ? "Payment verified as paid."
          : "Payment marked failed; order cancelled and stock restored.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
