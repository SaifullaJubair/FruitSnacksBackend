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
    // 11β HIGH 6 (D6 anon BOGO) — coupon_code is the only hard requirement.
    // customer_id is OPTIONAL: BOGO coupons must work for anonymous FB-ad
    // traffic, and even percent/fixed lookups should fail with a clearer
    // message than "code or customer required".
    if (!coupon_code) {
      throw new ApiError(400, "Coupon code is required");
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
    // M18: date-range validation. Mirrors order.recompute.ts logic so the cart
    // UI claim and the order placement recompute agree on the same valid
    // window. end_date uses end-of-day grace (+ 86400000ms) so a coupon dated
    // "ends 2026-06-04" stays valid through that whole day.
    const now = new Date();
    const start = result?.coupon_start_date
      ? new Date(result.coupon_start_date)
      : null;
    const end = result?.coupon_end_date
      ? new Date(result.coupon_end_date)
      : null;
    if (start && now < start) {
      throw new ApiError(400, "Coupon is not yet active");
    }
    if (end && now > new Date(end.getTime() + 86400000)) {
      throw new ApiError(400, "Coupon has expired");
    }
    // Customer-specific allowlist only enforceable when caller is logged in.
    // Anonymous BOGO (D6) skips it; for non-BOGO + anon, the recompute path at
    // checkout still re-validates so this isn't a security hole.
    if (result?.coupon_customer_type === "specific" && customer_id) {
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
    // Per-user usage cap only checkable when we know who the user is.
    if (customer_id) {
      // Was result?.coupon_id — the coupon doc has no coupon_id field (it's
      // _id), so this lookup always returned null and the per-person cap
      // silently never fired here. Use _id. (Order-time recompute already
      // enforces it, so this was a dead validation-stage check, not a hole.)
      const getCouponUserIsUsedThisCoupon: ICouponUsedInterface | any =
        await getCouponUserByIdServices(result?._id, customer_id);
      if (getCouponUserIsUsedThisCoupon) {
        if (
          result?.coupon_use_per_person <= getCouponUserIsUsedThisCoupon?.used
        ) {
          throw new ApiError(400, "Already use this coupon");
        }
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
