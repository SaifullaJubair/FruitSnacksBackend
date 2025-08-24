import { NextFunction, Request, RequestHandler, Response } from "express";
import ApiError from "../../errors/ApiError";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import OrderModel from "../order/order.model";
import OfferOrderModel from "../offerOrder/offerOrder.model";
import ReviewModel from "../review/review.model";
import UserModel from "../user/user.model";
import ProductModel from "../product/product.model";
import AdminModel from "../adminRegLog/admin.model";
import QuestionModel from "../question/question.model";
import CouponModel from "../coupon/coupon.model";
import CampaignModel from "../campaign/campaign.model";
import OfferModel from "../offer/offer.model";
import CategoryModel from "../category/category.model";
import BrandModel from "../brand/brand.model";

// get dashboard data
export const findDashboardDataServices: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const totalOrder: any = await OrderModel.countDocuments({});
    const totalOfferOrder: any = await OfferOrderModel.countDocuments({});
    const totalUser: any = await UserModel.countDocuments({});
    const totalProduct: any = await ProductModel.countDocuments({});
    const totalStaff: any = await AdminModel.countDocuments({});
    const totalReview: any = await ReviewModel.countDocuments({});
    const totalQuestion: any = await QuestionModel.countDocuments({});
    const totalCoupon: any = await CouponModel.countDocuments({});
    const totalCampaign: any = await CampaignModel.countDocuments({});
    const totalOffer: any = await OfferModel.countDocuments({});
    const totalCategory: any = await CategoryModel.countDocuments({});
    const totalBrand: any = await BrandModel.countDocuments({});

    const sendData = [
      {
        url_link: "/order",
        title: "Total Orders",
        number: totalOrder,
      },
      // {
      //   url_link: "/offer-order-list",
      //   title: "Total Offer Orders",
      //   number: totalOfferOrder,
      // },
      {
        url_link: "/customer",
        title: "Total Customers",
        number: totalUser,
      },
      {
        url_link: "/product/product-list",
        title: "Total Products",
        number: totalProduct,
      },
      {
        url_link: "/all-staff",
        title: "Total Staffs",
        number: totalStaff,
      },
      {
        url_link: "/review",
        title: "Total Reviews",
        number: totalReview,
      },
      // {
      //   url_link: "/question",
      //   title: "Total Questions",
      //   number: totalQuestion,
      // },
      // {
      //   url_link: "/your-coupon",
      //   title: "Total Coupons",
      //   number: totalCoupon,
      // },
      // {
      //   url_link: "/campaign-list",
      //   title: "Total Campaigns",
      //   number: totalCampaign,
      // },
      // {
      //   url_link: "/offer-list",
      //   title: "Total Offers",
      //   number: totalOffer,
      // },
      {
        url_link: "/category",
        title: "Total Categories",
        number: totalCategory,
      },
      {
        url_link: "/brand-category",
        title: "Total Brands",
        number: totalBrand,
      },
    ];

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
