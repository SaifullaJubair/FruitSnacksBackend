import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { FileUploadHelper } from "../../helpers/image.upload";
import ApiError from "../../errors/ApiError";
import * as fs from "fs";
import { IBannerInterface } from "./banner.interface";
import {
  deleteBannerServices,
  findABannerSerialServices,
  findAllBannerServices,
  findAllDashboardBannerServices,
  postBannerServices,
  updateBannerServices,
} from "./banner.services";
import BannerModel from "./banner.model";

// Add A Banner
export const postBanner: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IBannerInterface | any> => {
  try {
    if (req.files && "banner_image" in req.files && req.body) {
      const requestData = req.body;
      const findBannerIsExistWithSerial: IBannerInterface | null =
        await findABannerSerialServices(requestData?.banner_serial);
      if (findBannerIsExistWithSerial) {
        fs.unlinkSync(req.files.banner_image[0].path);
        throw new ApiError(400, "Serial Number Previously Added !");
      }
      // get the Banner image and upload
      let banner_image;
      let banner_image_key;
      if (req.files && "banner_image" in req.files) {
        const BannerImage = req.files["banner_image"][0];
        const banner_image_upload = await FileUploadHelper.uploadToSpaces(
          BannerImage
        );
        banner_image = banner_image_upload?.Location;
        banner_image_key = banner_image_upload?.Key;
      }
      const data = { ...requestData, banner_image, banner_image_key };
      const result: IBannerInterface | {} = await postBannerServices(data);
      if (result) {
        return sendResponse<IBannerInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Banner Added Successfully !",
        });
      } else {
        throw new ApiError(400, "Banner Added Failed !");
      }
    } else {
      throw new ApiError(400, "Image Upload Failed");
    }
  } catch (error: any) {
    next(error);
  }
};

// Find All Banner
export const findAllBanner: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IBannerInterface | any> => {
  try {
    const result: IBannerInterface[] | any = await findAllBannerServices();
    return sendResponse<IBannerInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Banner Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All dashboard Banner
export const findAllDashboardBanner: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IBannerInterface | any> => {
  try {
    const { page, limit } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: IBannerInterface[] | any =
      await findAllDashboardBannerServices(limitNumber, skip);
    const total = await BannerModel.countDocuments();
    return sendResponse<IBannerInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Banner Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update A Banner
export const updateBanner: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IBannerInterface | any> => {
  try {
    if (req.files && "banner_image" in req.files && req.body) {
      const requestData = req.body;
      const findBannerIsExistWithSerial: IBannerInterface | null =
        await findABannerSerialServices(requestData?.banner_serial);
      if (
        findBannerIsExistWithSerial &&
        requestData?._id !== findBannerIsExistWithSerial?._id.toString()
      ) {
        fs.unlinkSync(req.files.banner_image[0].path);
        throw new ApiError(400, "Serial Number Previously Added !");
      }
      // get the Banner image and upload
      let banner_image;
      let banner_image_key;
      if (req.files && "banner_image" in req.files) {
        const BannerImage = req.files["banner_image"][0];
        const banner_image_upload = await FileUploadHelper.uploadToSpaces(
          BannerImage
        );
        banner_image = banner_image_upload?.Location;
        banner_image_key = banner_image_upload?.Key;
      }
      const data = { ...requestData, banner_image, banner_image_key };
      const result: IBannerInterface | any = await updateBannerServices(
        data,
        requestData?._id
      );
      if (result?.modifiedCount > 0) {
        await FileUploadHelper.deleteFromSpaces(requestData?.banner_image_key);
        return sendResponse<IBannerInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Banner Update Successfully !",
        });
      } else {
        throw new ApiError(400, "Banner Update Failed !");
      }
    } else {
      const requestData = req.body;
      const findBannerIsExistWithSerial: IBannerInterface | null =
        await findABannerSerialServices(requestData?.banner_serial);
      if (
        findBannerIsExistWithSerial &&
        requestData?._id !== findBannerIsExistWithSerial?._id.toString()
      ) {
        throw new ApiError(400, "Serial Number Previously Added !");
      }
      const result: IBannerInterface | any = await updateBannerServices(
        requestData,
        requestData?._id
      );
      if (result?.modifiedCount > 0) {
        return sendResponse<IBannerInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Banner Update Successfully !",
        });
      } else {
        throw new ApiError(400, "Banner Update Failed !");
      }
    }
  } catch (error: any) {
    next(error);
  }
};

// delete A Banner item
export const deleteABannerInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const _id = req.body._id;
    const result = await deleteBannerServices(_id);
    if (result?.deletedCount > 0) {
      await FileUploadHelper.deleteFromSpaces(req.body?.banner_image_key);
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Banner Delete successfully !",
      });
    } else {
      throw new ApiError(400, "Banner delete failed !");
    }
  } catch (error) {
    next(error);
  }
};
