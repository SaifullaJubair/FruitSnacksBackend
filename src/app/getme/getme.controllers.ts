import { NextFunction, Request, RequestHandler, Response } from "express";
import ApiError from "../../errors/ApiError";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { findUserInfoServices } from "./getme.services";
import OrderModel from "../order/order.model";
import ReviewModel from "../review/review.model";
import { findTrendingProductServices } from "../product/product.services";
import UserModel from "../user/user.model";
import { verifyTokenAsync, COOKIE_NAMES } from "../../utils/auth.tokens";

// get a user (Phase D: central token helper; _id preferred, phone fallback)
export const getMeUser: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.cookies?.[COOKIE_NAMES.ACCESS];
    if (!token) throw new ApiError(401, "User get failed !");

    const decode: any = await verifyTokenAsync(token);
    if (decode?.kind && decode.kind !== "access") {
      throw new ApiError(401, "Refresh token cannot be used as access.");
    }
    if (decode?.who && decode.who !== "user") {
      throw new ApiError(401, "Not a user token.");
    }

    const user = decode?._id
      ? await UserModel.findById(decode._id).select("-user_password -forgot_otp")
      : await findUserInfoServices(decode?.user_phone);

    if (user) {
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "User get successfully !",
        data: user,
      });
    }
    throw new ApiError(404, "User not found !");
  } catch (error) {
    next(error);
  }
};

// Self-service profile update (Phase D — IDOR fix).
// Previously PATCH /get_me/ reused the admin `updateUser` which writes by
// body._id with no ownership check → any caller could edit any user, and the
// admin path re-hashes whatever user_password the FE echoes back (double-hash
// → locked-out account). This handler updates ONLY the logged-in user
// (req.user.id from verifyUserToken) and accepts a strict field allowlist —
// no _id, role, status, wallet, loyalty, verified, phone, or password (those
// have their own verified flows: /user/setNewPassword for password, etc.).
interface AuthedRequest extends Request {
  user?: { id: string; user_phone?: string };
}

const SELF_EDITABLE_FIELDS = [
  "user_name",
  "user_image",
  "user_image_key",
  "user_additional_phone",
  "user_gender",
  "user_country",
  "user_division",
  "user_district",
  "user_address",
] as const;

export const updateMyProfile: RequestHandler = async (
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new ApiError(401, "Login required!");

    const body = req.body ?? {};
    const update: Record<string, unknown> = {};
    for (const key of SELF_EDITABLE_FIELDS) {
      if (body[key] !== undefined) update[key] = body[key];
    }

    if (Object.keys(update).length === 0) {
      throw new ApiError(400, "Nothing to update.");
    }

    const result = await UserModel.updateOne({ _id: userId }, update, {
      runValidators: true,
    });
    if (result?.matchedCount === 0) throw new ApiError(404, "User not found!");

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Profile updated successfully!",
    });
  } catch (error) {
    next(error);
  }
};

// get profile dashboard data — own data only (req.user.id, not query)
export const findUserProfileDashboardDataServices: RequestHandler = async (
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user_id = req.user?.id;
    if (!user_id) {
      throw new ApiError(401, "Login required!");
    }
    // Phase B — offer orders now live in the orders collection (order_type:"offer").
    // totalOrder counts ALL orders (incl. offer); totalOfferOrder is the offer subset.
    const totalOrder: any = await OrderModel.countDocuments({
      customer_id: user_id,
    });
    const totalOfferOrder: any = await OrderModel.countDocuments({
      customer_id: user_id,
      order_type: "offer",
    });
    const totalReview: any = await ReviewModel.countDocuments({
      review_user_id: user_id,
    });

    const trendingProduct: any = await findTrendingProductServices(10, 1);

    const sendData = {
      totalOrder,
      totalOfferOrder,
      totalReview,
      trendingProduct,
    };

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Dashboard Data successfully !",
      data: sendData,
    });
  } catch (error) {
    next(error);
  }
};
