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

// User's own loyalty history. F3: include balance alongside rows so the
// storefront ledger page can render the balance card from one round-trip.
export const findMyLoyaltyHistory: RequestHandler = async (req, res, next): Promise<any> => {
  try {
    const user_id = (req as any).user?.id;
    if (!user_id) throw new ApiError(401, "Login required");
    const { page = 1, limit = 20 } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);
    const r = await findMyLoyaltyHistoryServices(user_id, Number(limit), skip);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Loyalty history.",
      data: { rows: r.rows, balance: r.balance },
      totalData: r.total,
    });
  } catch (e) { next(e); }
};

// Admin viewer — pick any user_id and read their loyalty ledger + balance.
// Reuses findMyLoyaltyHistoryServices (the "my" is just whose id is passed in).
export const findAdminLoyaltyHistory: RequestHandler = async (req, res, next): Promise<any> => {
  try {
    const { user_id, page = 1, limit = 50 } = req.query as any;
    if (!user_id) throw new ApiError(400, "user_id query param required");
    const skip = (Number(page) - 1) * Number(limit);
    const r = await findMyLoyaltyHistoryServices(user_id, Number(limit), skip);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Loyalty history (admin).",
      data: { rows: r.rows, balance: r.balance },
      totalData: r.total,
    });
  } catch (e) { next(e); }
};
