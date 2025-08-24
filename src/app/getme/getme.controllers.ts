import { NextFunction, Request, RequestHandler, Response } from "express";
import ApiError from "../../errors/ApiError";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { findUserInfoServices } from "./getme.services";
import OrderModel from "../order/order.model";
import OfferOrderModel from "../offerOrder/offerOrder.model";
import ReviewModel from "../review/review.model";
import { findTrendingProductServices } from "../product/product.services";
const { promisify } = require("util");
const jwt = require("jsonwebtoken");

// get a user
export const getMeUser: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = await req.cookies?.artisan_lather_token;

    if (!token) {
      throw new ApiError(400, "User get failed !");
    }
    const decode = await promisify(jwt.verify)(
      token,
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Im5hem11bEBnbWFpbC5jb20iLCJpYXQiOjE2OTQ0MzExOTF9.xtLPsJrvJ0Gtr4rsnHh1kok51_pU10_hYLilZyBiRAM"
    );
    // const decode = await promisify(jwt.verify)(token, process.env.ACCESS_TOKEN);

    const user = await findUserInfoServices(decode?.user_phone);

    if (user) {
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "User get successfully !",
        data: user,
      });
    }
    throw new ApiError(400, "User get failed !");
  } catch (error) {
    next(error);
  }
};

// get profile dashboard data
export const findUserProfileDashboardDataServices: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      throw new ApiError(400, "User Id Required");
    }
    const totalOrder: any = await OrderModel.countDocuments({
      customer_id: user_id,
    });
    const totalOfferOrder: any = await OfferOrderModel.countDocuments({
      customer_id: user_id,
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
