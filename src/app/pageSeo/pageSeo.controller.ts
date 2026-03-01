import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import sendResponse from "../../shared/sendResponse";
import {
  getAllPageSeoService,
  getPageSeoByKeyService,
  updatePageSeoService,
  seedPageSeoService,
} from "./pageSeo.services";

// GET /page-seo — সব pages
export const getAllPageSeo: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await getAllPageSeoService();
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Page SEO data fetched successfully!",
      data,
    });
  } catch (error) {
    next(error);
  }
};

// GET /page-seo/:key — একটা page
export const getPageSeoByKey: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { key } = req.params;
    const data = await getPageSeoByKeyService(key);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Page SEO fetched successfully!",
      data,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /page-seo/:key — update
export const updatePageSeo: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { key } = req.params;
    const { title, description, noIndex } = req.body;

    const data = await updatePageSeoService(key, {
      title,
      description,
      noIndex,
    });
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Page SEO updated successfully!",
      data,
    });
  } catch (error) {
    next(error);
  }
};

// POST /page-seo/seed — default data DB তে ঢোকানো
export const seedPageSeo: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await seedPageSeoService();
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: `Seed complete! Created: ${result.created}, Skipped: ${result.skipped}`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
