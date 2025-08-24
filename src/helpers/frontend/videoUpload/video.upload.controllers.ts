
import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import { FileUploadHelper } from "../../image.upload";
import sendResponse from "../../../shared/sendResponse";
import ApiError from "../../../errors/ApiError";

// post a video
export const postVideoUpload: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (req.files && "video" in req.files) {
            const videoData = req.files["video"][0];
            const video_upload = await FileUploadHelper.VideoUploader(videoData);
            return sendResponse(res, {
                statusCode: httpStatus.OK,
                success: true,
                message: "video upload successfully !",
                data: video_upload,
            });
        } else {
            throw new ApiError(400, "video Upload Failed !");
        }
    } catch (error) {
        next(error);
    }
};
