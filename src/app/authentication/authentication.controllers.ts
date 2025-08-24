import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { Types } from "mongoose";
import { authenticationSearchableField, IAuthenticationInterface } from "./authentication.interface";
import { deleteAuthenticationServices, findAllAuthenticationServices, findAllDashboardAuthenticationServices, postAuthenticationServices, updateAuthenticationServices } from "./authentication.services";
import AuthenticationModel from "./authentication.model";

// Add A Authentication
export const postAuthentication: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IAuthenticationInterface | any> => {
  try {
    const requestData = req.body;
    const result: IAuthenticationInterface | {} = await postAuthenticationServices(
      requestData
    );
    if (result) {
      return sendResponse<IAuthenticationInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Authentication Added Successfully !",
      });
    } else {
      throw new ApiError(400, "Authentication Added Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};

// Find All dashboard Authentication
export const findAllDashboardAuthentication: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IAuthenticationInterface | any> => {
  try {
    const { page, limit, searchTerm } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: IAuthenticationInterface[] | any =
      await findAllDashboardAuthenticationServices(limitNumber, skip, searchTerm);
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: authenticationSearchableField.map((field) => ({
          [field]: { $regex: searchTerm, $options: "i" },
        })),
      });
    }

    const whereCondition: any =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await AuthenticationModel.countDocuments(whereCondition);
    return sendResponse<IAuthenticationInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Authentication Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All Authentication
export const findAllAuthentication: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IAuthenticationInterface | any> => {
  try {
    const result: IAuthenticationInterface[] | any = await findAllAuthenticationServices();
    return sendResponse<IAuthenticationInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Authentication Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update A Authentication
export const updateAuthentication: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IAuthenticationInterface | any> => {
  try {
    const requestData = req.body;
    const result: IAuthenticationInterface | any = await updateAuthenticationServices(
      requestData,
      requestData?._id
    );
    if (result?.modifiedCount > 0) {
      return sendResponse<IAuthenticationInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Authentication Update Successfully !",
      });
    } else {
      throw new ApiError(400, "Authentication Update Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};

// delete A Authentication item
export const deleteAAuthenticationInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const _id = req.body._id;
    const result = await deleteAuthenticationServices(_id);
    if (result?.deletedCount > 0) {
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Authentication Delete Successfully !",
      });
    } else {
      throw new ApiError(400, "Authentication Delete Failed !");
    }
  } catch (error) {
    next(error);
  }
};
