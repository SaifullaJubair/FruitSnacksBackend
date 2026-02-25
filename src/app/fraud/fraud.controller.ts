import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";
import { fraudCheckService } from "./fraud.service";
import sendResponse from "../../shared/sendResponse";

export const fraudCheck = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { phone_number } = req.body;

    if (!phone_number) {
      return res.status(400).json({
        success: false,
        message: "phone_number is required",
      });
    }

    const result = await fraudCheckService(phone_number);

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Fraud check সফল!",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};
