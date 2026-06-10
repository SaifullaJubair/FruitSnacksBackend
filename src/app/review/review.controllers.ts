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
  findAllSeededReviewServices,
  findReviewsByIdsServices,
  findUnReviewedProductServices,
  findUserReviewServices,
  postReviewServices,
  seedReviewBulkServices,
  seedReviewManualServices,
  updateReviewServices,
} from "./review.services";
import ReviewModel from "./review.model";
import { FileUploadHelper } from "../../helpers/image.upload";
import * as fs from "fs";
import { getCachedSetting } from "../../helpers/settingCache";

// Add A Review
export const postReview: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IReviewInterface | any> => {
  try {
    const requestData = req.body;

    // C13 BLOCKER 3 — FE hardcodes review_status:"active" (ToBeReviewedTab.jsx:41).
    // Strip it and override server-side based on the auto_approve_reviews toggle.
    // Default to "pending" when setting is absent (fresh DB / undefined) — matches model default.
    delete requestData.review_status;
    const setting = await getCachedSetting().catch(() => null);
    const autoApprove = setting?.auto_approve_reviews ?? false;
    requestData.review_status = autoApprove ? "active" : "pending";

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

// Find All Review — respects enable_seeded_reviews setting
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

    const setting = await getCachedSetting().catch(() => null);
    const showSeeded = setting?.enable_seeded_reviews ?? true;

    const result: IReviewInterface[] | any = await findAllReviewServices(
      review_product_id,
      limitNumber,
      skip,
      showSeeded,
    );
    const countFilter: any = { review_status: "active", review_product_id };
    if (!showSeeded) countFilter.is_seeded = { $ne: true };
    const totalData = await ReviewModel.countDocuments(countFilter);
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
    const { page, limit, searchTerm, status } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: IReviewInterface[] | any =
      await findAllDashboardReviewServices(limitNumber, skip, searchTerm, status as string | undefined);
    const andCondition: any[] = [];
    if (status) {
      andCondition.push({ review_status: status });
    }
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

// ─── Seed Review — Bulk Upload ────────────────────────────────────────────────
// POST /api/v1/review/seed/bulk?dry_run=true|false
// Body: JSON array via req.body.rows  OR  CSV file parsed upstream (multer → csvParse)
export const seedReviewBulk: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const dry_run = req.query.dry_run === "true";
    let rows: any[] = [];

    // Accept JSON body array
    if (Array.isArray(req.body)) {
      rows = req.body;
    } else if (Array.isArray(req.body?.rows)) {
      rows = req.body.rows;
    } else {
      throw new ApiError(400, "Body must be a JSON array or { rows: [...] }");
    }

    const result = await seedReviewBulkServices(rows, dry_run);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: dry_run
        ? `Dry run: would insert ${result.inserted}, skip ${result.skipped}, fail ${result.failed.length}`
        : `Seeded ${result.inserted} reviews. Skipped ${result.skipped} duplicates.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Seed Review — Manual Admin Add ──────────────────────────────────────────
// POST /api/v1/review/seed/manual
export const seedReviewManual: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let review_image: string | undefined;
    if (req.files && "review_image" in req.files) {
      const imgFile = (req.files as any)["review_image"][0];
      const uploaded = await FileUploadHelper.uploadToSpaces(imgFile);
      review_image = uploaded?.Location;
    }
    const result = await seedReviewManualServices({ ...req.body, review_image });
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Seed review added successfully!",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Seed Review — List (admin) ───────────────────────────────────────────────
// GET /api/v1/review/seed/list
export const findAllSeededReview: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page = 1, limit = 20, searchTerm, product_id } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const { reviews, totalCount } = await findAllSeededReviewServices(limitNumber, skip, searchTerm as string, product_id as string);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Seeded reviews found!",
      data: reviews,
      totalData: totalCount,
    });
  } catch (error) {
    next(error);
  }
};

// Track D — Reviews carousel manual-pick: fetch specific reviews by IDs
// GET /api/v1/review/by-ids?ids=id1,id2,id3 (public, for storefront carousel)
export const findReviewsByIds: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const idsParam = req.query.ids as string;
    if (!idsParam) {
      return sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Reviews fetched", data: [] });
    }
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
    const result = await findReviewsByIdsServices(ids);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Reviews fetched",
      data: result,
    });
  } catch (error) {
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
