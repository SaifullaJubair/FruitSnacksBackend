import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { FileUploadHelper } from "../../helpers/image.upload";
import ApiError from "../../errors/ApiError";
import * as fs from "fs";
import { ISubCategoryInterface, subcategorySearchableField } from "./sub_category.interface";
import SubCategoryModel from "./sub_category.model";
import {
  deleteSubCategoryServices,
  findAllDashboardSubCategoryServices,
  findAllSubCategoryServices,
  postSubCategoryServices,
  updateSubCategoryServices,
} from "./sub_category.services";
import ChildCategoryModel from "../child_category/child_category.model";
import SpecificationModel from "../specification/specification.model";
import ProductModel from "../product/product.model";

// Add A SubCategory
export const postSubCategory: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ISubCategoryInterface | any> => {
  try {
    if (req.files && "sub_category_logo" in req.files && req.body) {
      const requestData = req.body;
      const findSubCategoryNameExit: boolean | null | undefined | any =
        await SubCategoryModel.exists({
          $and: [
            { sub_category_slug: requestData?.sub_category_slug },
            { category_id: requestData?.category_id },
          ],
        });
      if (findSubCategoryNameExit) {
        fs.unlinkSync(req.files.sub_category_logo[0].path);
        throw new ApiError(400, "Already Added !");
      }
      const findSubCategorySerialExit: boolean | null | undefined | any =
        await SubCategoryModel.exists({
          $and: [
            { sub_category_serial: requestData?.sub_category_serial },
            { category_id: requestData?.category_id },
          ],
        });
      if (findSubCategorySerialExit) {
        fs.unlinkSync(req.files.sub_category_logo[0].path);
        throw new ApiError(400, "Serial Number Previously Added !");
      }
      // get the Subcategory image and upload
      let sub_category_logo;
      let sub_category_logo_key;
      if (req.files && "sub_category_logo" in req.files) {
        const SubcategoryImage = req.files["sub_category_logo"][0];
        const sub_category_logo_upload = await FileUploadHelper.uploadToSpaces(
          SubcategoryImage
        );
        sub_category_logo = sub_category_logo_upload?.Location;
        sub_category_logo_key = sub_category_logo_upload?.Key;
      }
      const data = { ...requestData, sub_category_logo, sub_category_logo_key };
      const result: ISubCategoryInterface | {} = await postSubCategoryServices(
        data
      );
      if (result) {
        return sendResponse<ISubCategoryInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "SubCategory Added Successfully !",
        });
      } else {
        throw new ApiError(400, "SubCategory Added Failed !");
      }
    } else {
      throw new ApiError(400, "Image Upload Failed");
    }
  } catch (error: any) {
    next(error);
  }
};

// Find All SubCategory
export const findAllSubCategory: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ISubCategoryInterface | any> => {
  try {
    const result: ISubCategoryInterface[] | any =
      await findAllSubCategoryServices();
    return sendResponse<ISubCategoryInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "SubCategory Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All dashboard SubCategory
export const findAllDashboardSubCategory: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ISubCategoryInterface | any> => {
  try {
    const { page, limit, searchTerm } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: ISubCategoryInterface[] | any =
      await findAllDashboardSubCategoryServices(limitNumber, skip, searchTerm);
      const andCondition = [];
  if (searchTerm) {
    andCondition.push({
      $or: subcategorySearchableField.map((field) => ({
        [field]: {
          $regex: searchTerm,
          $options: "i",
        },
      })),
    });
  }
  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await SubCategoryModel.countDocuments(whereCondition);
    return sendResponse<ISubCategoryInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "SubCategory Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update A SubCategory
export const updateSubCategory: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ISubCategoryInterface | any> => {
  try {
    if (req.files && "sub_category_logo" in req.files && req.body) {
      const requestData = req.body;
      const findSubCategoryNameExit: boolean | null | undefined | any =
        await SubCategoryModel.exists({
          $and: [
            { sub_category_slug: requestData?.sub_category_slug },
            { category_id: requestData?.category_id },
          ],
        });
      if (
        findSubCategoryNameExit &&
        requestData?._id !== findSubCategoryNameExit?._id.toString()
      ) {
        fs.unlinkSync(req.files.sub_category_logo[0].path);
        throw new ApiError(400, "Already Added !");
      }
      const findSubCategorySerialExit: boolean | null | undefined | any =
        await SubCategoryModel.exists({
          $and: [
            { sub_category_serial: requestData?.sub_category_serial },
            { category_id: requestData?.category_id },
          ],
        });
      if (
        findSubCategorySerialExit &&
        requestData?._id !== findSubCategorySerialExit?._id.toString()
      ) {
        fs.unlinkSync(req.files.sub_category_logo[0].path);
        throw new ApiError(400, "Serial Number Previously Added !");
      }
      // get the Subcategory image and upload
      let sub_category_logo;
      let sub_category_logo_key;
      if (req.files && "sub_category_logo" in req.files) {
        const SubcategoryImage = req.files["sub_category_logo"][0];
        const sub_category_logo_upload = await FileUploadHelper.uploadToSpaces(
          SubcategoryImage
        );
        sub_category_logo = sub_category_logo_upload?.Location;
        sub_category_logo_key = sub_category_logo_upload?.Key;
      }
      const data = { ...requestData, sub_category_logo, sub_category_logo_key };
      const result: ISubCategoryInterface | any =
        await updateSubCategoryServices(data, requestData?._id);
      if (result?.modifiedCount > 0) {
        if (requestData?.sub_category_logo_key) {
          await FileUploadHelper.deleteFromSpaces(
            requestData?.sub_category_logo_key
          );
        }
        return sendResponse<ISubCategoryInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "SubCategory Update Successfully !",
        });
      } else {
        throw new ApiError(400, "SubCategory Update Failed !");
      }
    } else {
      const requestData = req.body;
      const findSubCategoryNameExit: boolean | null | undefined | any =
        await SubCategoryModel.exists({
          $and: [
            { sub_category_slug: requestData?.sub_category_slug },
            { category_id: requestData?.category_id },
          ],
        });
      if (
        findSubCategoryNameExit &&
        requestData?._id !== findSubCategoryNameExit?._id.toString()
      ) {
        throw new ApiError(400, "Already Added !");
      }
      const findSubCategorySerialExit: boolean | null | undefined | any =
        await SubCategoryModel.exists({
          $and: [
            { sub_category_serial: requestData?.sub_category_serial },
            { category_id: requestData?.category_id },
          ],
        });
      if (
        findSubCategorySerialExit &&
        requestData?._id !== findSubCategorySerialExit?._id.toString()
      ) {
        throw new ApiError(400, "Serial Number Previously Added !");
      }
      const result: ISubCategoryInterface | any =
        await updateSubCategoryServices(requestData, requestData?._id);
      if (result?.modifiedCount > 0) {
        return sendResponse<ISubCategoryInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "SubCategory Update Successfully !",
        });
      } else {
        throw new ApiError(400, "SubCategory Update Failed !");
      }
    }
  } catch (error: any) {
    next(error);
  }
};

// delete A SubCategory item
export const deleteASubCategoryInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sub_category_id = req.body._id;
    const findSubCategoryInChildCategoryExist:
      | boolean
      | null
      | undefined
      | any = await ChildCategoryModel.exists({
      sub_category_id: sub_category_id,
    });
    if (findSubCategoryInChildCategoryExist) {
      throw new ApiError(400, "Already Added In ChildCategory !");
    }
    const findSubCategoryInSpecificationExist:
      | boolean
      | null
      | undefined
      | any = await SpecificationModel.exists({
      sub_category_id: sub_category_id,
    });
    if (findSubCategoryInSpecificationExist) {
      throw new ApiError(400, "Already Added In Specification !");
    }
    const findSubCategoryInProductExist: boolean | null | undefined | any =
      await ProductModel.exists({
        sub_category_id: sub_category_id,
      });
    if (findSubCategoryInProductExist) {
      throw new ApiError(400, "Already Added In Product !");
    }
    const result = await deleteSubCategoryServices(sub_category_id);
    if (result?.deletedCount > 0) {
      if (req.body?.sub_category_logo_key) {
        await FileUploadHelper.deleteFromSpaces(
          req.body?.sub_category_logo_key
        );
      }
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "SubCategory Delete successfully !",
      });
    } else {
      throw new ApiError(400, "SubCategory delete failed !");
    }
  } catch (error) {
    next(error);
  }
};
