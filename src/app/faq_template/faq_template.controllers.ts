import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import sendResponse from "../../shared/sendResponse";
import ApiError from "../../errors/ApiError";
import {
  createFaqTemplateService,
  deleteFaqTemplateService,
  findFaqTemplateByIdService,
  listFaqTemplatesService,
  listFaqTemplateTopicsService,
  updateFaqTemplateService,
} from "./faq_template.services";
import { IFaqTemplateInterface } from "./faq_template.interface";

export const postFaqTemplate: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = (req as any)?.user?._id;
    const data = { ...req.body, created_by: adminId };
    const result = await createFaqTemplateService(data);
    return sendResponse<IFaqTemplateInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "FAQ template created",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const findAllFaqTemplates: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { category, is_active, search, page, limit } = req.query;
    const result = await listFaqTemplatesService({
      category: category as string | undefined,
      is_active:
        is_active === "true" ? true : is_active === "false" ? false : undefined,
      search: search as string | undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return sendResponse<IFaqTemplateInterface[]>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "FAQ templates fetched",
      data: result.data as any,
      totalData: result.total,
    });
  } catch (error) {
    next(error);
  }
};

export const findFaqTemplateTopics: RequestHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await listFaqTemplateTopicsService();
    return sendResponse<string[]>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "FAQ template topics fetched",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const findFaqTemplateById: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await findFaqTemplateByIdService(req.params.id);
    if (!result) throw new ApiError(404, "FAQ template not found");
    return sendResponse<IFaqTemplateInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "FAQ template fetched",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const patchFaqTemplate: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await updateFaqTemplateService(req.params.id, req.body);
    if (!result || (result as any).matchedCount === 0) {
      throw new ApiError(404, "FAQ template not found");
    }
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "FAQ template updated",
    });
  } catch (error) {
    next(error);
  }
};

export const deleteFaqTemplate: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await deleteFaqTemplateService(req.params.id);
    if (!result.deletedCount) {
      throw new ApiError(404, "FAQ template not found");
    }
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "FAQ template deleted",
    });
  } catch (error) {
    next(error);
  }
};
