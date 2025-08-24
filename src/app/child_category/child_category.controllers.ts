import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { childcategorySearchableField, IChildCategoryInterface } from "./child_category.interface";
import ChildCategoryModel from "./child_category.model";
import {
  deleteChildCategoryServices,
  findAllChildCategoryServices,
  findAllDashboardChildCategoryServices,
  postChildCategoryServices,
  updateChildCategoryServices,
} from "./child_category.services";
import ProductModel from "../product/product.model";

// Add A ChildCategory
export const postChildCategory: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IChildCategoryInterface | any> => {
  try {
    const requestData = req.body;
    const findChildCategoryNameExit: boolean | null | undefined | any =
      await ChildCategoryModel.exists({
        $and: [
          { child_category_slug: requestData?.child_category_slug },
          { category_id: requestData?.category_id },
          { sub_category_id: requestData?.sub_category_id },
        ],
      });
    if (findChildCategoryNameExit) {
      throw new ApiError(400, "Already Added !");
    }
    const findChildCategorySerialExit: boolean | null | undefined | any =
      await ChildCategoryModel.exists({
        $and: [
          { child_category_serial: requestData?.child_category_serial },
          { category_id: requestData?.category_id },
          { sub_category_id: requestData?.sub_category_id },
        ],
      });
    if (findChildCategorySerialExit) {
      throw new ApiError(400, "Serial Number Previously Added !");
    }
    const result: IChildCategoryInterface | {} =
      await postChildCategoryServices(requestData);
    if (result) {
      return sendResponse<IChildCategoryInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "ChildCategory Added Successfully !",
      });
    } else {
      throw new ApiError(400, "ChildCategory Added Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};

// Find All ChildCategory
export const findAllChildCategory: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IChildCategoryInterface | any> => {
  try {
    const result: IChildCategoryInterface[] | any =
      await findAllChildCategoryServices();
    return sendResponse<IChildCategoryInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "ChildCategory Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All dashboard ChildCategory
export const findAllDashboardChildCategory: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IChildCategoryInterface | any> => {
  try {
    const { page, limit, searchTerm } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: IChildCategoryInterface[] | any =
      await findAllDashboardChildCategoryServices(
        limitNumber,
        skip,
        searchTerm
      );
      const andCondition = [];
  if (searchTerm) {
    andCondition.push({
      $or: childcategorySearchableField.map((field) => ({
        [field]: {
          $regex: searchTerm,
          $options: "i",
        },
      })),
    });
  }
  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await ChildCategoryModel.countDocuments(whereCondition);
    return sendResponse<IChildCategoryInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "ChildCategory Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update A ChildCategory
export const updateChildCategory: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IChildCategoryInterface | any> => {
  try {
    const requestData = req.body;
    const findChildCategoryNameExit: boolean | null | undefined | any =
      await ChildCategoryModel.exists({
        $and: [
          { child_category_slug: requestData?.child_category_slug },
          { category_id: requestData?.category_id },
          { sub_category_id: requestData?.sub_category_id },
        ],
      });
    if (
      findChildCategoryNameExit &&
      requestData?._id !== findChildCategoryNameExit?._id.toString()
    ) {
      throw new ApiError(400, "Already Added !");
    }
    const findChildCategorySerialExit: boolean | null | undefined | any =
      await ChildCategoryModel.exists({
        $and: [
          { child_category_serial: requestData?.child_category_serial },
          { category_id: requestData?.category_id },
          { sub_category_id: requestData?.sub_category_id },
        ],
      });
    if (
      findChildCategorySerialExit &&
      requestData?._id !== findChildCategorySerialExit?._id.toString()
    ) {
      throw new ApiError(400, "Serial Number Previously Added !");
    }
    const result: IChildCategoryInterface | any =
      await updateChildCategoryServices(requestData, requestData?._id);
    if (result?.modifiedCount > 0) {
      return sendResponse<IChildCategoryInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "ChildCategory Update Successfully !",
      });
    } else {
      throw new ApiError(400, "ChildCategory Update Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};

// delete A ChildCategory item
export const deleteAChildCategoryInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const child_category_id = req.body._id;
    const findChildCategoryInProductExist: boolean | null | undefined | any =
      await ProductModel.exists({
        child_category_id: child_category_id,
      });
    if (findChildCategoryInProductExist) {
      throw new ApiError(400, "Already Added In Product !");
    }
    const result = await deleteChildCategoryServices(child_category_id);
    if (result?.deletedCount > 0) {
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "ChildCategory Delete successfully !",
      });
    } else {
      throw new ApiError(400, "ChildCategory delete failed !");
    }
  } catch (error) {
    next(error);
  }
};
