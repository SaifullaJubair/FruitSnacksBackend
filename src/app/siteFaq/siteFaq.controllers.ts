import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import {
  deleteSiteFaqServices,
  findActiveSiteFaqServices,
  findAllSiteFaqServices,
  postSiteFaqServices,
  updateSiteFaqServices,
} from "./siteFaq.services";

export const postSiteFaq: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const data = {
      ...req.body,
      _publisher_id: (req as any).user?._id,
    };
    const result = await postSiteFaqServices(data);
    return sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Site FAQ created successfully",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

export const findAllSiteFaq: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const page = parseInt(req.query.page as string) || 1;
    const skip = (page - 1) * limit;
    const searchTerm = req.query.search as string | undefined;
    const { data, total } = await findAllSiteFaqServices(limit, skip, searchTerm);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Site FAQs fetched",
      data,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Public — active only, for storefront home FAQ section
export const findActiveSiteFaq: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const result = await findActiveSiteFaqServices();
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Site FAQs fetched",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateSiteFaq: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { id } = req.params;
    if (!id) throw new ApiError(400, "FAQ ID required");
    const data = { ...req.body, _updated_by: (req as any).user?._id };
    const result = await updateSiteFaqServices(id, data);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Site FAQ updated",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

export const deleteSiteFaq: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { id } = req.params;
    if (!id) throw new ApiError(400, "FAQ ID required");
    await deleteSiteFaqServices(id);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Site FAQ deleted",
    });
  } catch (error: any) {
    next(error);
  }
};
