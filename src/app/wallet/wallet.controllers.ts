import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import sendResponse from "../../shared/sendResponse";
import ApiError from "../../errors/ApiError";
import { moveWallet, findWalletHistoryServices } from "./wallet.services";

// Admin top-up (or debit) a user's wallet.
export const adminAdjustWallet: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { user_id, delta, reason } = req.body || {};
    const performed_by = (req as any).userId;
    const r = await moveWallet(
      user_id,
      Number(delta),
      Number(delta) >= 0 ? "admin_credit" : "admin_debit",
      { reason, performed_by },
    );
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Wallet updated.",
      data: r,
    });
  } catch (e) {
    next(e);
  }
};

// Admin viewer — pick any user_id, view their wallet ledger + balance. Mirrors
// the F3 loyalty admin-history shape so the admin Wallet page reuses the same
// render pattern as the Loyalty page.
export const findAdminWalletHistory: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { user_id, page = 1, limit = 50 } = req.query as any;
    if (!user_id) throw new ApiError(400, "user_id query param required");
    const skip = (Number(page) - 1) * Number(limit);
    const r = await findWalletHistoryServices(user_id, Number(limit), skip);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Wallet history (admin).",
      data: { rows: r.rows, balance: r.balance },
      totalData: r.total,
    });
  } catch (e) {
    next(e);
  }
};

// User's own history (paginated).
export const findMyWalletHistory: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const user_id = (req as any).user?.id || (req.query as any)?.user_id;
    if (!user_id) throw new ApiError(400, "user_id required");
    const { page = 1, limit = 20 } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);
    const r = await findWalletHistoryServices(user_id, Number(limit), skip);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Wallet history.",
      // F3 — wrap rows + balance together so storefront renders the balance
      // card from one round-trip (matches /loyalty/history shape).
      data: { rows: r.rows, balance: r.balance },
      totalData: r.total,
    });
  } catch (e) {
    next(e);
  }
};
