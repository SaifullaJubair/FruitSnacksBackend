import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import sendResponse from "../../shared/sendResponse";
import ApiError from "../../errors/ApiError";
import {
  moveLoyalty,
  findMyLoyaltyHistoryServices,
} from "./loyalty.services";

// Admin manual adjust.
export const adminAdjustLoyalty: RequestHandler = async (req, res, next): Promise<any> => {
  try {
    const { user_id, delta, reason } = req.body || {};
    const performed_by = (req as any).userId;
    const r = await moveLoyalty(
      user_id,
      Number(delta),
      "admin_adjust",
      { reason, performed_by },
    );
    return sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Loyalty updated.", data: r });
  } catch (e) { next(e); }
};

// User's own loyalty history.
export const findMyLoyaltyHistory: RequestHandler = async (req, res, next): Promise<any> => {
  try {
    const user_id = (req as any).user?.id;
    if (!user_id) throw new ApiError(401, "Login required");
    const { page = 1, limit = 20 } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);
    const r = await findMyLoyaltyHistoryServices(user_id, Number(limit), skip);
    return sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Loyalty history.", data: r.rows, totalData: r.total });
  } catch (e) { next(e); }
};
