import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { FileUploadHelper } from "../../helpers/image.upload";
import ApiError from "../../errors/ApiError";
import * as fs from "fs";
import { brandSearchableField, IBrandInterface } from "./brand.interface";
import BrandModel from "./brand.model";
import {
  deleteBrandServices,
  findAllBrandServices,
  findAllDashboardBrandServices,
  postBrandServices,
  updateBrandServices,
} from "./brand.services";
import ProductModel from "../product/product.model";

// Add A Brand
export const postBrand: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IBrandInterface | any> => {
  try {
    if (req.files && "brand_logo" in req.files && req.body) {
      const requestData = req.body;
      const findBrandNameExit: boolean | null | undefined | any =
        await BrandModel.exists({
          $and: [
            { brand_slug: requestData?.brand_slug },
            // { category_id: requestData?.category_id },
          ],
        });
      if (findBrandNameExit) {
        fs.unlinkSync(req.files.brand_logo[0].path);
        throw new ApiError(400, "Already Added !");
      }
      const findBrandSerialExit: boolean | null | undefined | any =
        await BrandModel.exists({
          $and: [
            { brand_serial: requestData?.brand_serial },
            // { category_id: requestData?.category_id },
          ],
        });
      if (findBrandSerialExit) {
        fs.unlinkSync(req.files.brand_logo[0].path);
        throw new ApiError(400, "Serial Number Previously Added !");
      }
      if (requestData?.brand_show == true) {
        const findBrandIsMoreThanTwleve = await BrandModel.countDocuments({
          brand_show: true,
        });
        if (findBrandIsMoreThanTwleve >= 12) {
          fs.unlinkSync(req.files.brand_logo[0].path);
          throw new ApiError(400, "Already 12 Selected !");
        }
      }
      // get the Brand image and upload
      let brand_logo;
      let brand_logo_key;
      if (req.files && "brand_logo" in req.files) {
        const BrandImage = req.files["brand_logo"][0];
        const brand_logo_upload = await FileUploadHelper.uploadToSpaces(
          BrandImage
        );
        brand_logo = brand_logo_upload?.Location;
        brand_logo_key = brand_logo_upload?.Key;
      }
      const data = { ...requestData, brand_logo, brand_logo_key };
      const result: IBrandInterface | {} = await postBrandServices(data);
      if (result) {
        return sendResponse<IBrandInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Brand Added Successfully !",
        });
      } else {
        throw new ApiError(400, "Brand Added Failed !");
      }
    } else {
      throw new ApiError(400, "Image Upload Failed");
    }
  } catch (error: any) {
    next(error);
  }
};

// Find All Brand
export const findAllBrand: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IBrandInterface | any> => {
  try {
    const result: IBrandInterface[] | any = await findAllBrandServices();
    return sendResponse<IBrandInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Brand Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All dashboard Brand
export const findAllDashboardBrand: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IBrandInterface | any> => {
  try {
    const { page, limit, searchTerm } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: IBrandInterface[] | any = await findAllDashboardBrandServices(
      limitNumber,
      skip,
      searchTerm
    );
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: brandSearchableField.map((field) => ({
          [field]: {
            $regex: searchTerm,
            $options: "i",
          },
        })),
      });
    }
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await BrandModel.countDocuments(whereCondition);
    return sendResponse<IBrandInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Brand Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update A Brand
export const updateBrand: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IBrandInterface | any> => {
  try {
    if (req.files && "brand_logo" in req.files && req.body) {
      const requestData = req.body;
      const findBrandNameExit: boolean | null | undefined | any =
        await BrandModel.exists({
          $and: [
            { brand_slug: requestData?.brand_slug },
            // { category_id: requestData?.category_id },
          ],
        });
      if (
        findBrandNameExit &&
        requestData?._id !== findBrandNameExit?._id.toString()
      ) {
        fs.unlinkSync(req.files.brand_logo[0].path);
        throw new ApiError(400, "Already Added !");
      }
      const findBrandSerialExit: boolean | null | undefined | any =
        await BrandModel.exists({
          $and: [
            { brand_serial: requestData?.brand_serial },
            // { category_id: requestData?.category_id },
          ],
        });
      if (
        findBrandSerialExit &&
        requestData?._id !== findBrandSerialExit?._id.toString()
      ) {
        fs.unlinkSync(req.files.brand_logo[0].path);
        throw new ApiError(400, "Serial Number Previously Added !");
      }
      if (requestData?.brand_show == true) {
        const findBrandIsMoreThanTwleve = await BrandModel.countDocuments({
          brand_show: true,
          _id: { $ne: requestData?._id },
        });
        if (findBrandIsMoreThanTwleve >= 12) {
          fs.unlinkSync(req.files.brand_logo[0].path);
          throw new ApiError(400, "Already 12 Selected !");
        }
      }
      // get the Brand image and upload
      let brand_logo;
      let brand_logo_key;
      if (req.files && "brand_logo" in req.files) {
        const BrandImage = req.files["brand_logo"][0];
        const brand_logo_upload = await FileUploadHelper.uploadToSpaces(
          BrandImage
        );
        brand_logo = brand_logo_upload?.Location;
        brand_logo_key = brand_logo_upload?.Key;
      }
      const data = { ...requestData, brand_logo, brand_logo_key };
      const result: IBrandInterface | any = await updateBrandServices(
        data,
        requestData?._id
      );
      if (result?.modifiedCount > 0) {
        if (requestData?.brand_logo_key) {
          await FileUploadHelper.deleteFromSpaces(requestData?.brand_logo_key);
        }
        return sendResponse<IBrandInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Brand Update Successfully !",
        });
      } else {
        throw new ApiError(400, "Brand Update Failed !");
      }
    } else {
      const requestData = req.body;
      const findBrandNameExit: boolean | null | undefined | any =
        await BrandModel.exists({
          $and: [
            { brand_slug: requestData?.brand_slug },
            // { category_id: requestData?.category_id },
          ],
        });
      if (
        findBrandNameExit &&
        requestData?._id !== findBrandNameExit?._id.toString()
      ) {
        throw new ApiError(400, "Already Added !");
      }
      const findBrandSerialExit: boolean | null | undefined | any =
        await BrandModel.exists({
          $and: [
            { brand_serial: requestData?.brand_serial },
            // { category_id: requestData?.category_id },
          ],
        });
      if (
        findBrandSerialExit &&
        requestData?._id !== findBrandSerialExit?._id.toString()
      ) {
        throw new ApiError(400, "Serial Number Previously Added !");
      }
      if (requestData?.brand_show == true) {
        const findFeatureBrandIsMoreThanSix = await BrandModel.countDocuments({
          brand_show: true,
          _id: { $ne: requestData?._id },
        });
        if (findFeatureBrandIsMoreThanSix >= 12) {
          throw new ApiError(400, "Already 12 Selected !");
        }
      }
      const result: IBrandInterface | any = await updateBrandServices(
        requestData,
        requestData?._id
      );
      if (result?.modifiedCount > 0) {
        return sendResponse<IBrandInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Brand Update Successfully !",
        });
      } else {
        throw new ApiError(400, "Brand Update Failed !");
      }
    }
  } catch (error: any) {
    next(error);
  }
};

// delete A Brand item
export const deleteABrandInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const brand_id = req.body._id;
    const findSubCategoryInProductExist: boolean | null | undefined | any =
      await ProductModel.exists({
        brand_id: brand_id,
      });
    if (findSubCategoryInProductExist) {
      throw new ApiError(400, "Already Added In Product !");
    }
    const result = await deleteBrandServices(brand_id);
    if (result?.deletedCount > 0) {
      if (req.body?.brand_logo_key) {
        await FileUploadHelper.deleteFromSpaces(req.body?.brand_logo_key);
      }
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Brand Delete successfully !",
      });
    } else {
      throw new ApiError(400, "Brand delete failed !");
    }
  } catch (error) {
    next(error);
  }
};
