import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { IReviewInterface, reviewSearchableField } from "./review.interface";
import {
  deleteReviewServices,
  findAReviewSerialServices,
  findAllDashboardReviewServices,
  findAllReviewServices,
  findUnReviewedProductServices,
  findUserReviewServices,
  postReviewServices,
  updateReviewServices,
} from "./review.services";
import ReviewModel from "./review.model";
import { FileUploadHelper } from "../../helpers/image.upload";
import * as fs from "fs";

// Add A Review
export const postReview: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IReviewInterface | any> => {
  try {
    const requestData = req.body;
    if (req.files && "review_image" in req.files) {
      const findReviewIsExist: IReviewInterface | null =
        await findAReviewSerialServices(
          requestData?.review_user_id,
          requestData?.review_product_id
        );
      if (findReviewIsExist) {
        fs.unlinkSync(req.files.review_image[0].path);
        throw new ApiError(400, "Previously Comment !");
      }
      // get the category image and upload
      let review_image;
      if (req.files && "review_image" in req.files) {
        const categoryImage = req.files["review_image"][0];
        const review_image_upload = await FileUploadHelper.uploadToSpaces(
          categoryImage
        );
        review_image = review_image_upload?.Location;
      }
      const data = { ...requestData, review_image };
      const result: IReviewInterface | {} = await postReviewServices(data);
      if (result) {
        return sendResponse<IReviewInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Review Added Successfully !",
        });
      } else {
        throw new ApiError(400, "Review Added Failed !");
      }
    } else {
      const findReviewIsExist: IReviewInterface | null =
        await findAReviewSerialServices(
          requestData?.review_user_id,
          requestData?.review_product_id
        );
      if (findReviewIsExist) {
        throw new ApiError(400, "Previously Comment !");
      }
      const result: IReviewInterface | {} = await postReviewServices(
        requestData
      );
      if (result) {
        return sendResponse<IReviewInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Review Added Successfully !",
        });
      } else {
        throw new ApiError(400, "Review Added Failed !");
      }
    }
  } catch (error: any) {
    next(error);
  }
};

// Find All Review
export const findAllReview: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IReviewInterface | any> => {
  try {
    const { review_product_id } = req.params;
    const { page, limit } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: IReviewInterface[] | any = await findAllReviewServices(
      review_product_id,
      limitNumber,
      skip
    );
    const totalData = await ReviewModel.countDocuments({
      $and: [
        { review_status: "active" },
        { review_product_id: review_product_id },
      ],
    });
    return sendResponse<IReviewInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Review Found Successfully !",
      data: result,
      totalData: totalData,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All Review
export const findAllUnReviewProduct: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IReviewInterface | any> => {
  try {
    const { customer_id } = req.query;
    if (!customer_id) {
      throw new ApiError(400, "Customer Id is required !");
    }
    const result: IReviewInterface[] | any =
      await findUnReviewedProductServices(customer_id);
    return sendResponse<IReviewInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Product Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find AUser Review
export const findUserReview: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IReviewInterface | any> => {
  try {
    const { page, limit, searchTerm, review_user_id }: any = req.query;
    if (!review_user_id) {
      throw new ApiError(400, "Review Product Publisher Id is required !");
    }
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: IReviewInterface[] | any = await findUserReviewServices(
      limitNumber,
      skip,
      searchTerm,
      review_user_id
    );
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: reviewSearchableField.map((field) => ({
          [field]: {
            $regex: searchTerm,
            $options: "i",
          },
        })),
      });
    }
    andCondition.push({
      review_user_id: review_user_id,
    });
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await ReviewModel.countDocuments(whereCondition);
    return sendResponse<IReviewInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Review Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All dashboard Review
export const findAllDashboardReview: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IReviewInterface | any> => {
  try {
    const { page, limit, searchTerm } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: IReviewInterface[] | any =
      await findAllDashboardReviewServices(limitNumber, skip, searchTerm);
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: reviewSearchableField.map((field) => ({
          [field]: {
            $regex: searchTerm,
            $options: "i",
          },
        })),
      });
    }
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await ReviewModel.countDocuments(whereCondition);
    return sendResponse<IReviewInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Review Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update A Review
export const updateReview: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IReviewInterface | any> => {
  try {
    const requestData = req.body;
    const result: IReviewInterface | any = await updateReviewServices(
      requestData,
      requestData?._id
    );
    if (result?.modifiedCount > 0) {
      return sendResponse<IReviewInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Review Update Successfully !",
      });
    } else {
      throw new ApiError(400, "Review Update Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};

// delete A Review item
export const deleteAReviewInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const _id = req.body._id;
    const result = await deleteReviewServices(_id);
    if (result?.deletedCount > 0) {
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Review Delete successfully !",
      });
    } else {
      throw new ApiError(400, "Review delete failed !");
    }
  } catch (error) {
    next(error);
  }
};
