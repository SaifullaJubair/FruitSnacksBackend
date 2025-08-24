import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { FileUploadHelper } from "../../helpers/image.upload";
import ApiError from "../../errors/ApiError";
import * as fs from "fs";
import { ISliderInterface } from "./slider.interface";
import { deleteSliderServices, findAllDashboardSliderServices, findAllSliderServices, findASliderSerialServices, postSliderServices, updateSliderServices } from "./slider.services";
import SliderModel from "./slider.model";

// Add A Slider
export const postSlider: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ISliderInterface | any> => {
  try {
    if (req.files && "slider_image" in req.files && req.body) {
      const requestData = req.body;
      const findSliderIsExistWithSerial: ISliderInterface | null =
        await findASliderSerialServices(requestData?.slider_serial);
      if (findSliderIsExistWithSerial) {
        fs.unlinkSync(req.files.slider_image[0].path);
        throw new ApiError(400, "Serial Number Previously Added !");
      }
      // get the Slider image and upload
      let slider_image;
      let slider_image_key;
      if (req.files && "slider_image" in req.files) {
        const SliderImage = req.files["slider_image"][0];
        const slider_image_upload = await FileUploadHelper.uploadToSpaces(
          SliderImage
        );
        slider_image = slider_image_upload?.Location;
        slider_image_key = slider_image_upload?.Key;
      }
      const data = { ...requestData, slider_image, slider_image_key };
      const result: ISliderInterface | {} = await postSliderServices(data);
      if (result) {
        return sendResponse<ISliderInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Slider Added Successfully !",
        });
      } else {
        throw new ApiError(400, "Slider Added Failed !");
      }
    } else {
      throw new ApiError(400, "Image Upload Failed");
    }
  } catch (error: any) {
    next(error);
  }
};

// Find All Slider
export const findAllSlider: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ISliderInterface | any> => {
  try {
    const result: ISliderInterface[] | any = await findAllSliderServices();
    return sendResponse<ISliderInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Slider Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All dashboard Slider
export const findAllDashboardSlider: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ISliderInterface | any> => {
  try {
    const { page, limit } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: ISliderInterface[] | any =
      await findAllDashboardSliderServices(limitNumber, skip);
    const total = await SliderModel.countDocuments({slider_status: "active"});
    return sendResponse<ISliderInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Slider Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update A Slider
export const updateSlider: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ISliderInterface | any> => {
  try {
    if (req.files && "slider_image" in req.files && req.body) {
      const requestData = req.body;
      const findSliderIsExistWithSerial: ISliderInterface | null =
        await findASliderSerialServices(requestData?.slider_serial);
      if (
        findSliderIsExistWithSerial &&
        requestData?._id !== findSliderIsExistWithSerial?._id.toString()
      ) {
        fs.unlinkSync(req.files.slider_image[0].path);
        throw new ApiError(400, "Serial Number Previously Added !");
      }
      // get the Slider image and upload
      let slider_image;
      let slider_image_key;
      if (req.files && "slider_image" in req.files) {
        const SliderImage = req.files["slider_image"][0];
        const slider_image_upload = await FileUploadHelper.uploadToSpaces(
          SliderImage
        );
        slider_image = slider_image_upload?.Location;
        slider_image_key = slider_image_upload?.Key;
      }
      const data = { ...requestData, slider_image, slider_image_key };
      const result: ISliderInterface | any = await updateSliderServices(
        data,
        requestData?._id
      );
      if (result?.modifiedCount > 0) {
        await FileUploadHelper.deleteFromSpaces(requestData?.slider_image_key);
        return sendResponse<ISliderInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Slider Update Successfully !",
        });
      } else {
        throw new ApiError(400, "Slider Update Failed !");
      }
    } else {
      const requestData = req.body;
      const findSliderIsExistWithSerial: ISliderInterface | null =
        await findASliderSerialServices(requestData?.slider_serial);
      if (
        findSliderIsExistWithSerial &&
        requestData?._id !== findSliderIsExistWithSerial?._id.toString()
      ) {
        throw new ApiError(400, "Serial Number Previously Added !");
      }
      const result: ISliderInterface | any = await updateSliderServices(
        requestData,
        requestData?._id
      );
      if (result?.modifiedCount > 0) {
        return sendResponse<ISliderInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Slider Update Successfully !",
        });
      } else {
        throw new ApiError(400, "Slider Update Failed !");
      }
    }
  } catch (error: any) {
    next(error);
  }
};

// delete A Slider item
export const deleteASliderInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const _id = req.body._id;
    const result = await deleteSliderServices(_id);
    if (result?.deletedCount > 0) {
      await FileUploadHelper.deleteFromSpaces(req.body?.slider_image_key);
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Slider Delete successfully !",
      });
    } else {
      throw new ApiError(400, "Slider delete failed !");
    }
  } catch (error) {
    next(error);
  }
};
