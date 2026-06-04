import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import sendResponse from "../../shared/sendResponse";
import ApiError from "../../errors/ApiError";
import {
  findVariationsByProductService,
  updateVariationService,
} from "./variation.services";

// GET /variation/by-product/:productId
export const findVariationsByProduct: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await findVariationsByProductService(req.params.productId);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Variations fetched",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /variation/:id  — partial update; primarily for variation_weight_grams + variation_badge_text
export const patchVariation: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const allowedKeys = [
      "variation_weight_grams",
      "variation_badge_text",
      "variation_badge_icon_key",
      "variation_price",
      "variation_discount_price",
      "variation_buying_price",
      "variation_quantity",
      "variation_alert_quantity",
      "variation_sku",
      "variation_barcode",
      // A2 (2026-06-04) — admin Stock/Variations Modal needs to toggle a
      // single variation on/off without re-running the full product-update
      // flow (which wipes other fields). Also used by Quick Stock save.
      "is_active",
      "variation_name",
    ] as const;
    const update: any = {};
    for (const k of allowedKeys) {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    }
    if (Object.keys(update).length === 0) {
      throw new ApiError(400, "No updatable fields provided");
    }
    const result = await updateVariationService(id, update);
    if (!result || (result as any).matchedCount === 0) {
      throw new ApiError(404, "Variation not found");
    }
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Variation updated",
    });
  } catch (error) {
    next(error);
  }
};
