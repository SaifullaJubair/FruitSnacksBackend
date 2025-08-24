import httpStatus from "http-status";
import sendResponse from "../../shared/sendResponse";
import { IProductInterface } from "../product/product.interface";
import {
  findAllActiveFilteredProductServices,
  findAllActiveSideFilteredDataServices,
  findAllHeadingSub_Child_CategoryDataServices,
  findAllSearchTermProductServices,
} from "./product.filter.services";
import { NextFunction, Request, RequestHandler, Response } from "express";

// Find All heading subcategory childcategory Data
export const findAllHeadingSub_Child_CategoryData: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IProductInterface | any> => {
  try {
    const { categoryType, sub_categoryType, child_categoryType } = req.query;
    const result: any = await findAllHeadingSub_Child_CategoryDataServices(
      categoryType,
      sub_categoryType,
      child_categoryType
    );
    return sendResponse<IProductInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Category Data Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All side Filtered Data
export const findAllSideFilteredData: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IProductInterface | any> => {
  try {
    const { categoryType } = req.params;
    const { subCategoryType, childCategoryType } = req.query;
    const result: any = await findAllActiveSideFilteredDataServices(
      categoryType,
      subCategoryType,
      childCategoryType
    );
    return sendResponse<IProductInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Product Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All Filtered Product
export const findAllFilteredProduct: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IProductInterface | any> => {
  try {
    const {
      categoryType,
      sub_categoryType,
      // child_categoryType,
      filterData,
      page = 1,
      limit = 20,
    } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const conditions: any = {};

    if (categoryType) {
      conditions.categoryType = categoryType;
    }

    if (sub_categoryType) {
      conditions.sub_categoryType = sub_categoryType;
    }

    // if (child_categoryType) {
    //   conditions.child_categoryType = child_categoryType;
    // }
    const result: IProductInterface[] | any =
      await findAllActiveFilteredProductServices(
        conditions,
        filterData,
        limitNumber,
        skip
      );
    return sendResponse<IProductInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Product Found Successfully !",
      data: result?.filteredData,
      totalData: result?.totalData,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All Search Product
export const findAllSearchTermProduct: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IProductInterface | any> => {
  try {
    const { page = 1, limit = 20, searchTerm } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const result: IProductInterface[] | any =
      await findAllSearchTermProductServices(limitNumber, skip, searchTerm);
    return sendResponse<IProductInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Product Found Successfully !",
      data: result?.data,
      totalData: result?.totalData,
    });
  } catch (error: any) {
    next(error);
  }
};
