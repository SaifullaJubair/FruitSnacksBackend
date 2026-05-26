import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import sendResponse from "../../shared/sendResponse";
import {
  captureAbandonedCartServices,
  findAllAbandonedCartServices,
} from "./abandonedCart.services";

export const captureAbandonedCart: RequestHandler = async (req, res, next): Promise<any> => {
  try {
    const r = await captureAbandonedCartServices(req.body);
    return sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Captured.", data: r });
  } catch (e) { next(e); }
};

export const findAllAbandonedCart: RequestHandler = async (req, res, next): Promise<any> => {
  try {
    const { page = 1, limit = 50, recovered, min_age_minutes } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);
    const recoveredFlag =
      typeof recovered === "string"
        ? recovered === "true"
          ? true
          : recovered === "false"
            ? false
            : undefined
        : undefined;
    const r = await findAllAbandonedCartServices(Number(limit), skip, {
      recovered: recoveredFlag,
      min_age_minutes: min_age_minutes ? Number(min_age_minutes) : undefined,
    });
    return sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Abandoned carts.", data: r.rows, totalData: r.total });
  } catch (e) { next(e); }
};
