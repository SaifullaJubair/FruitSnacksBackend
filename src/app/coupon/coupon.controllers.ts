import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { couponSearchableField, ICouponInterface } from "./coupon.interface";
import {
  deleteCouponServices,
  findACouponServices,
  findAllDashboardCouponServices,
  findAllSpecificUserCouponServices,
  findProductToAddCouponServices,
  postCouponServices,
  updateCouponServices,
} from "./coupon.services";
import CouponModel from "./coupon.model";
import { ICouponUsedInterface } from "./coupon_used/coupon.used.interface";
import { getCouponUserByIdServices } from "./coupon_used/coupon.used.services";
import { Types } from "mongoose";
import UserModel from "../user/user.model";
import ProductModel from "../product/product.model";
import { IUserInterface } from "../user/user.interface";
import OrderModel from "../order/order.model";

// Add A Coupon
export const postCoupon: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ICouponInterface | any> => {
  try {
    const requestData = req.body;
    const sendData = {
      ...requestData,
      coupon_available: requestData?.coupon_use_total_person,
    };
    const result: ICouponInterface | {} = await postCouponServices(sendData);
    if (result) {
      return sendResponse<ICouponInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Coupon Added Successfully !",
      });
    } else {
      throw new ApiError(400, "Coupon Added Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};

// Find A Coupon
export const findACoupon: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ICouponInterface | any> => {
  try {
    const { coupon_code, customer_id, panel_owner_id } = req.body;
    if (!coupon_code || !customer_id) {
      throw new ApiError(400, "Coupon code or customer id is required");
    }
    const result: ICouponInterface[] | any = await findACouponServices(
      coupon_code
    );
    if (!result) {
      throw new ApiError(400, "Coupon is invalid");
    }
    if (
      result?.coupon_available <= 0 ||
      result?.coupon_status === "in-active"
    ) {
      throw new ApiError(400, "Coupon is expired");
    }
    if (result?.coupon_customer_type === "specific") {
      if (result?.coupon_specific_customer?.length > 0) {
        const isCustomerAllowed = result?.coupon_specific_customer?.some(
          (customer: any) =>
            customer.customer_id.equals(new Types.ObjectId(customer_id))
        );

        if (!isCustomerAllowed) {
          throw new ApiError(400, "You are not allowed to use this coupon");
        }
      }
    }
    const getCouponUserIsUsedThisCoupon: ICouponUsedInterface | any =
      await getCouponUserByIdServices(result?.coupon_id, customer_id);
    if (getCouponUserIsUsedThisCoupon) {
      if (
        result?.coupon_use_per_person <= getCouponUserIsUsedThisCoupon?.used
      ) {
        throw new ApiError(400, "Already use this coupon");
      }
    }
    return sendResponse<ICouponInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Coupon Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All dashboard Coupon
export const findAllDashboardCoupon: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ICouponInterface | any> => {
  try {
    const { page, limit, searchTerm } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: ICouponInterface[] | any =
      await findAllDashboardCouponServices(limitNumber, skip, searchTerm);
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: couponSearchableField.map((field) => ({
          [field]: { $regex: searchTerm, $options: "i" },
        })),
      });
    }

    const whereCondition: any =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await CouponModel.countDocuments(whereCondition);
    return sendResponse<ICouponInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Coupon Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All Self dashboard Coupon
export const findAllSpecificUserCoupon: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IUserInterface | any> => {
  try {
    const { page, limit, searchTerm }: any = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: IUserInterface[] | any =
      await findAllSpecificUserCouponServices(limitNumber, skip, searchTerm);

    const andCondition: any[] = [];
    if (searchTerm) {
      andCondition.push({
        $or: couponSearchableField.map((field) => ({
          [field]: { $regex: searchTerm, $options: "i" },
        })),
      });
    }
    const whereCondition: any =
      andCondition.length > 0 ? { $and: andCondition } : {};

    const total = await UserModel.countDocuments(whereCondition);
    return sendResponse<IUserInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "User Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All product for Coupon
export const findProductToAddCoupon: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any | any> => {
  try {
    const { page, limit, searchTerm }: any = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: any[] | any = await findProductToAddCouponServices(
      limitNumber,
      skip,
      searchTerm
    );

    const andCondition: any[] = [];
    if (searchTerm) {
    }
    andCondition.push({ product_status: "active" });
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await ProductModel.countDocuments(whereCondition);
    return sendResponse<any>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Coupon Product Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update A Coupon
export const updateCoupon: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ICouponInterface | any> => {
  try {
    const requestData = req.body;
    const {coupon_status} = requestData;
    // const sendData = {
    //   ...requestData,
    //   coupon_available: requestData?.coupon_use_total_person,
    // };

    const result: ICouponInterface | any = await updateCouponServices(
      requestData,
      requestData?._id,
      coupon_status
    );
    if (result?.modifiedCount > 0) {
      return sendResponse<ICouponInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Coupon Update Successfully !",
      });
    } else {
      throw new ApiError(400, "Coupon Update Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};

// delete A Coupon item
export const deleteACouponInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const _id = req.body._id;

    const findCouponInOrderExist: boolean | null | undefined | any =
      await OrderModel.exists({
        coupon_id: _id,
      });
    if (findCouponInOrderExist) {
      throw new ApiError(400, "Already Added In Order !");
    }

    const result = await deleteCouponServices(_id);
    if (result?.deletedCount > 0) {
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Coupon Delete Successfully !",
      });
    } else {
      throw new ApiError(400, "Coupon Delete Failed !");
    }
  } catch (error) {
    next(error);
  }
};
