import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import sendResponse from "../../shared/sendResponse";
import {
  getTrustPointsService,
  updateTrustPointsService,
} from "./trustPoint.services";

// Public — storefront reads this to render "আমাদের প্রতিশ্রুতি".
export const getTrustPoints: RequestHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await getTrustPointsService();
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Trust points fetched",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Admin — replace the whole list.
export const putTrustPoints: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = (req as any)?.user?._id;
    const result = await updateTrustPointsService(req.body?.points, adminId);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Trust points updated",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
