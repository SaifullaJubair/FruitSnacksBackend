import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import {
  ISupplierInterface,
  supplierSearchableField,
} from "./supplier.interface";
import {
  deleteSupplierServices,
  findAllDashboardSupplierServices,
  findAllSupplierServices,
  postSupplierServices,
  updateSupplierServices,
} from "./supplier.services";
import SupplierModel from "./supplier.model";
import { Types } from "mongoose";

// Add A Supplier
export const postSupplier: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ISupplierInterface | any> => {
  try {
    const requestData = req.body;
    const result: ISupplierInterface | {} = await postSupplierServices(
      requestData
    );
    if (result) {
      return sendResponse<ISupplierInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Supplier Added Successfully !",
      });
    } else {
      throw new ApiError(400, "Supplier Added Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};

// Find All dashboard Supplier
export const findAllDashboardSupplier: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ISupplierInterface | any> => {
  try {
    const { page, limit, searchTerm } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: ISupplierInterface[] | any =
      await findAllDashboardSupplierServices(limitNumber, skip, searchTerm);
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: supplierSearchableField.map((field) => ({
          [field]: { $regex: searchTerm, $options: "i" },
        })),
      });
    }

    const whereCondition: any =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await SupplierModel.countDocuments(whereCondition);
    return sendResponse<ISupplierInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Supplier Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All Supplier
export const findAllSupplier: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ISupplierInterface | any> => {
  try {
    const result: ISupplierInterface[] | any = await findAllSupplierServices();
    return sendResponse<ISupplierInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Supplier Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update A Supplier
export const updateSupplier: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ISupplierInterface | any> => {
  try {
    const requestData = req.body;
    const result: ISupplierInterface | any = await updateSupplierServices(
      requestData,
      requestData?._id
    );
    if (result?.modifiedCount > 0) {
      return sendResponse<ISupplierInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Supplier Update Successfully !",
      });
    } else {
      throw new ApiError(400, "Supplier Update Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};

// delete A Supplier item
export const deleteASupplierInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const _id = req.body._id;
    const result = await deleteSupplierServices(_id);
    if (result?.deletedCount > 0) {
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Supplier Delete Successfully !",
      });
    } else {
      throw new ApiError(400, "Supplier Delete Failed !");
    }
  } catch (error) {
    next(error);
  }
};
