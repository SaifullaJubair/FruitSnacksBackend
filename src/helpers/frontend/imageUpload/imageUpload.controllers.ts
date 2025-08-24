
import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import { FileUploadHelper } from "../../image.upload";
import sendResponse from "../../../shared/sendResponse";
import ApiError from "../../../errors/ApiError";

// post a Image
export const postImageUpload: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
) =>  {
  try {
    if (req.files && "image" in req.files) {
      const imageData = req.files["image"][0];
      const image_upload = await FileUploadHelper.uploadToSpaces(imageData);
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Image upload successfully !",
        data: image_upload,
      });
    } else {
      throw new ApiError(400, "Image Upload Failed !");
    }
  } catch (error) {
    next(error);
  }
};
