import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import {
  ISpecificationInterface,
  specificationSearchableField,
  specificationValuesArray,
} from "./specification.interface";
import SpecificationModel from "./specification.model";
import {
  deleteSpecificationServices,
  findAllDashboardSpecificationServices,
  findAllSpecificationUsingCategoryIDServices,
  postSpecificationServices,
  updateSpecificationServices,
} from "./specification.services";
import ProductModel from "../product/product.model";

// Add A Specification
export const postSpecification: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ISpecificationInterface | any> => {
  try {
    const requestData = req.body;

    const findSpecificationNameExit: boolean | null | undefined | any =
      await SpecificationModel.exists({
        $and: [
          { specification_slug: requestData?.specification_slug },
          { category_id: requestData?.category_id },
          ...(requestData?.sub_category_id
            ? [{ sub_category_id: requestData.sub_category_id }]
            : []), // শর্ত যোগ করা হয়েছে
        ],
      });

    if (findSpecificationNameExit) {
      throw new ApiError(400, "Already Added !");
    }

    const findSpecificationIsExistSerial: boolean | null | undefined | any =
      await SpecificationModel.exists({
        $and: [
          { specification_serial: requestData?.specification_serial },
          { category_id: requestData?.category_id },
          ...(requestData?.sub_category_id
            ? [{ sub_category_id: requestData.sub_category_id }]
            : []), // শর্ত যোগ করা হয়েছে
        ],
      });
    if (findSpecificationIsExistSerial) {
      throw new ApiError(400, "Previously Added This Serial !");
    }

    // `specification_values` থেকে `specification_value_slug` গুলো সংগ্রহ করা হচ্ছে
    const specificationValueSlugs = requestData?.specification_values?.map(
      (item: specificationValuesArray) => item?.specification_value_slug
    );

    // যদি ডুপ্লিকেট স্লাগ থাকে তা চেক করা হচ্ছে
    const slugSet = new Set(specificationValueSlugs);
    if (slugSet?.size !== specificationValueSlugs?.length) {
      throw new ApiError(400, "Duplicate specification values Found!");
    }

    const result: ISpecificationInterface | {} =
      await postSpecificationServices(requestData);
    if (result) {
      return sendResponse<ISpecificationInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Specification Added Successfully !",
      });
    } else {
      throw new ApiError(400, "Specification Added Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};

// Find All Dashboard Specification
export const findAllDashboardSpecification: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ISpecificationInterface | any> => {
  try {
    const { page, limit, searchTerm } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: ISpecificationInterface[] | any =
      await findAllDashboardSpecificationServices(
        limitNumber,
        skip,
        searchTerm
      );
      const andCondition = [];
      if (searchTerm) {
        andCondition.push({
          $or: specificationSearchableField.map((field) => ({
            [field]: {
              $regex: searchTerm,
              $options: "i",
            },
          })),
        });
      }
      const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await SpecificationModel.countDocuments(whereCondition);
    return sendResponse<ISpecificationInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Specification Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All  Specification using categoryID
export const findAllSpecificationUsingCategoryID: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ISpecificationInterface | any> => {
  try {
    const { category_id } = req.params;
    const result: ISpecificationInterface[] | any =
      await findAllSpecificationUsingCategoryIDServices(category_id);
    return sendResponse<ISpecificationInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Specification Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update A Specification
export const updateSpecification: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ISpecificationInterface | any> => {
  try {
    const requestData = req.body;
    const findSpecificationNameExit: boolean | null | undefined | any =
      await SpecificationModel.exists({
        $and: [
          { specification_slug: requestData?.specification_slug },
          { category_id: requestData?.category_id },
          ...(requestData?.sub_category_id
            ? [{ sub_category_id: requestData.sub_category_id }]
            : []), // শর্ত যোগ করা হয়েছে
        ],
      });

    if (
      findSpecificationNameExit &&
      requestData?._id !== findSpecificationNameExit?._id.toString()
    ) {
      throw new ApiError(400, "Already Added !");
    }

    const findSpecificationIsExistSerial: boolean | null | undefined | any =
      await SpecificationModel.exists({
        $and: [
          { specification_serial: requestData?.specification_serial },
          { category_id: requestData?.category_id },
          ...(requestData?.sub_category_id
            ? [{ sub_category_id: requestData.sub_category_id }]
            : []), // শর্ত যোগ করা হয়েছে
        ],
      });
    if (
      findSpecificationIsExistSerial &&
      requestData?._id !== findSpecificationIsExistSerial?._id.toString()
    ) {
      throw new ApiError(400, "Previously Added This Serial !");
    }
    if (requestData?.specification_values) {
      // `specification_values` থেকে `specification_value_slug` গুলো সংগ্রহ করা হচ্ছে
      const specificationValueSlugs = requestData?.specification_values?.map(
        (item: specificationValuesArray) => item?.specification_value_slug
      );

      // যদি ডুপ্লিকেট স্লাগ থাকে তা চেক করা হচ্ছে
      const slugSet = new Set(specificationValueSlugs);
      if (slugSet?.size !== specificationValueSlugs?.length) {
        throw new ApiError(400, "Duplicate specification values Found!");
      }
    }

    const result: ISpecificationInterface | any =
      await updateSpecificationServices(requestData, requestData?._id);
    if (result?.modifiedCount > 0) {
      return sendResponse<ISpecificationInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Specification Update Successfully !",
      });
    } else {
      throw new ApiError(400, "Specification Update Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};

// delete A Specification item
export const deleteASpecificationInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const specification_id = req.body._id;
    const findSpecificationInProductExist: boolean | null | undefined | any =
      await ProductModel.exists({
        "specifications.specification_id": specification_id,
      });
    if (findSpecificationInProductExist) {
      throw new ApiError(400, "Already Added In Product !");
    }
    const result: ISpecificationInterface | any =
      await deleteSpecificationServices(specification_id);
    if (result?.deletedCount > 0) {
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Specification Delete successfully !",
      });
    } else {
      throw new ApiError(400, "Specification delete failed !");
    }
  } catch (error) {
    next(error);
  }
};
