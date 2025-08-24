import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import {
  attributeSearchableField,
  attributeValuesArray,
  IAttributeInterface,
} from "./attribute.interface";
import AttributeModel from "./attribute.model";
import {
  deleteAttributeServices,
  findAllAttributeServices,
  findAllAttributeUsingCategoryIDServices,
  findAllDashboardAttributeServices,
  postAttributeServices,
  updateAttributeServices,
} from "./attribute.services";

// Add A Attribute
export const postAttribute: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IAttributeInterface | any> => {
  try {
    const requestData = req.body;

    const findAttributeNameExit: boolean | null | undefined | any =
      await AttributeModel.exists({
        $and: [
          { attribute_slug: requestData?.attribute_slug },
          // { category_id: requestData?.category_id },
        ],
      });

    if (findAttributeNameExit) {
      throw new ApiError(400, "Already Added !");
    }

    // `attribute_values` থেকে `attribute_value_slug` গুলো সংগ্রহ করা হচ্ছে
    const AttributeValueSlugs = requestData?.attribute_values?.map(
      (item: attributeValuesArray) => item?.attribute_value_slug
    );

    // যদি ডুপ্লিকেট স্লাগ থাকে তা চেক করা হচ্ছে
    const slugSet = new Set(AttributeValueSlugs);
    if (slugSet?.size !== AttributeValueSlugs?.length) {
      throw new ApiError(400, "Duplicate Attribute values Found!");
    }

    const result: IAttributeInterface | {} = await postAttributeServices(
      requestData
    );
    if (result) {
      return sendResponse<IAttributeInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Attribute Added Successfully !",
      });
    } else {
      throw new ApiError(400, "Attribute Added Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};

// Find All Attribute
export const findAllAttribute: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IAttributeInterface | any> => {
  try {
    const result: IAttributeInterface[] | any =
      await findAllAttributeServices();
    return sendResponse<IAttributeInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Attribute Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};
// Find All Dashboard Attribute
export const findAllDashboardAttribute: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IAttributeInterface | any> => {
  try {
    const { page, limit, searchTerm } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: IAttributeInterface[] | any =
      await findAllDashboardAttributeServices(limitNumber, skip, searchTerm);
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: attributeSearchableField.map((field) => ({
          [field]: {
            $regex: searchTerm,
            $options: "i",
          },
        })),
      });
    }
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await AttributeModel.countDocuments(whereCondition);
    return sendResponse<IAttributeInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Attribute Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All  Attribute using categoryID
export const findAllAttributeUsingCategoryID: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IAttributeInterface | any> => {
  try {
    const { category_id } = req.params;
    const result: IAttributeInterface[] | any =
      await findAllAttributeUsingCategoryIDServices(category_id);
    return sendResponse<IAttributeInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Attribute Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update A Attribute
export const updateAttribute: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IAttributeInterface | any> => {
  try {
    const requestData = req.body;
    const findAttributeNameExit: boolean | null | undefined | any =
      await AttributeModel.exists({
        $and: [
          { attribute_slug: requestData?.attribute_slug },
          // { category_id: requestData?.category_id },
        ],
      });

    if (
      findAttributeNameExit &&
      requestData?._id !== findAttributeNameExit?._id.toString()
    ) {
      throw new ApiError(400, "Already Added !");
    }
    if (requestData?.attribute_values) {
      // `attribute_values` থেকে `attribute_value_slug` গুলো সংগ্রহ করা হচ্ছে
      const AttributeValueSlugs = requestData?.attribute_values?.map(
        (item: attributeValuesArray) => item?.attribute_value_slug
      );

      // যদি ডুপ্লিকেট স্লাগ থাকে তা চেক করা হচ্ছে
      const slugSet = new Set(AttributeValueSlugs);
      if (slugSet?.size !== AttributeValueSlugs?.length) {
        throw new ApiError(400, "Duplicate Attribute values Found!");
      }
    }

    const result: IAttributeInterface | any = await updateAttributeServices(
      requestData,
      requestData?._id
    );
    if (result?.modifiedCount > 0) {
      return sendResponse<IAttributeInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Attribute Update Successfully !",
      });
    } else {
      throw new ApiError(400, "Attribute Update Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};

// delete A Attribute item
export const deleteAAttributeInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const _id = req.body._id;
    // const existProduct: IProductInterface | null =
    //   await findAAttributeInProductServices(_id);
    // if (existProduct) {
    //   throw new ApiError(400, "This Attribute is exist in products !");
    // }
    const result: IAttributeInterface | any = await deleteAttributeServices(
      _id
    );
    if (result?.deletedCount > 0) {
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Attribute Delete successfully !",
      });
    } else {
      throw new ApiError(400, "Attribute delete failed !");
    }
  } catch (error) {
    next(error);
  }
};
