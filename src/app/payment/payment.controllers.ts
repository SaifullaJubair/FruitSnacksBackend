/**
 * payment.controllers.ts — HTTP handlers for Phase C payment endpoints.
 * Logic lives in payment.service.ts; these just unwrap req/res.
 */

import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import sendResponse from "../../shared/sendResponse";
import { submitTransaction, verifyPayment } from "./payment.service";
import { FileUploadHelper } from "../../helpers/image.upload";

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

// Customer submits trxId WITH a deposit-slip screenshot (Phase C4 bank
// transfer / also usable by manual MFS if the buyer chooses to attach proof).
// Multer parses the multipart form; the first uploaded file is treated as
// the screenshot and pushed to S3, then the rest of the body funnels into the
// shared `submitTransaction` helper. Screenshot url+key land in payment_meta.
export const submitOrderPaymentWithScreenshot: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { order_id } = req.params;
    const files = (req as any).files as Express.Multer.File[] | undefined;
    let screenshot_url: string | undefined;
    let screenshot_key: string | undefined;
    if (files && files.length > 0) {
      const uploaded = await FileUploadHelper.uploadToSpaces(files[0]);
      screenshot_url = uploaded?.Location;
      screenshot_key = uploaded?.Key;
    }
    const result = await submitTransaction(order_id, {
      ...(req.body || {}),
      screenshot_url,
      screenshot_key,
    });
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Payment submitted. Awaiting admin verification.",
      data: { ...result, screenshot_url },
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
