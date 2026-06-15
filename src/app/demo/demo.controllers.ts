import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import sendResponse from "../../shared/sendResponse";
import {
  clearDemoDataServices,
  countDemoDataServices,
} from "./demo.services";

// GET /demo/count — what a clear would remove (drives the admin confirm preview).
export const getDemoCount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const counts = await countDemoDataServices();
    const total =
      counts.products +
      counts.reviews +
      counts.banners +
      counts.sliders +
      counts.attributes +
      counts.categories;
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Demo data counts",
      data: { ...counts, total, has_demo: total > 0 },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /demo/clear — remove the whole demo catalog (flag-based, cascade).
export const clearDemoData = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const removed = await clearDemoDataServices();
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message:
        removed.product_errors > 0
          ? `Demo data cleared with ${removed.product_errors} product error(s) — check server logs.`
          : "Demo data cleared.",
      data: removed,
    });
  } catch (error) {
    next(error);
  }
};
