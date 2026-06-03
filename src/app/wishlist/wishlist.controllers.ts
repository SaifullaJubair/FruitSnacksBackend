import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import sendResponse from "../../shared/sendResponse";
import ApiError from "../../errors/ApiError";
import {
  addToWishlistServices,
  removeFromWishlistServices,
  findMyWishlistServices,
  syncWishlistServices,
  findAdminWishlistServices,
} from "./wishlist.services";

const me = (req: Request): string => {
  const id = (req as any).user?.id;
  if (!id) throw new ApiError(401, "Login required");
  return id;
};

export const addToWishlist: RequestHandler = async (req, res, next): Promise<any> => {
  try {
    const r = await addToWishlistServices(
      me(req),
      req.body?.product_id,
      req.body?.variation_id,
      req.body?.notify_back_in_stock,
    );
    return sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Added to wishlist.", data: r });
  } catch (e) { next(e); }
};

export const removeFromWishlist: RequestHandler = async (req, res, next): Promise<any> => {
  try {
    const r = await removeFromWishlistServices(
      me(req),
      req.body?.product_id,
      req.body?.variation_id,
    );
    return sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Removed from wishlist.", data: r });
  } catch (e) { next(e); }
};

export const findMyWishlist: RequestHandler = async (req, res, next): Promise<any> => {
  try {
    const { page = 1, limit = 100 } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);
    const r = await findMyWishlistServices(me(req), Number(limit), skip);
    return sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Wishlist.", data: r.rows, totalData: r.total });
  } catch (e) { next(e); }
};

// Admin viewer — paginated wishlist across all users with optional name/phone search.
export const findAdminWishlist: RequestHandler = async (req, res, next): Promise<any> => {
  try {
    const { page = 1, limit = 50, searchTerm } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);
    const r = await findAdminWishlistServices(Number(limit), skip, searchTerm);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Wishlist (admin).",
      data: r.rows,
      totalData: r.total,
    });
  } catch (e) {
    next(e);
  }
};

export const syncWishlist: RequestHandler = async (req, res, next): Promise<any> => {
  try {
    const r = await syncWishlistServices(me(req), req.body?.items || []);
    return sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Wishlist synced.", data: r });
  } catch (e) { next(e); }
};
