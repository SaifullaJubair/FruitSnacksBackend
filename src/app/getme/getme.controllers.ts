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

// get profile dashboard data
export const findUserProfileDashboardDataServices: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      throw new ApiError(400, "User Id Required");
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
