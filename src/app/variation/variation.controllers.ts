import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import sendResponse from "../../shared/sendResponse";
import ApiError from "../../errors/ApiError";
import {
  bulkUpdateVariationsService,
  findVariationsByProductService,
  updateVariationService,
  BulkVariationRow,
} from "./variation.services";

// Mirrors the per-product cap enforced in product.controllers.ts. Also keeps
// the JSON body well under express.json({ limit: "200kb" }) — the three
// editable fields are narrow, but a bigger row shape here would silently 413
// (and Express answers a 413 with HTML, which the admin's res.json() throws on).
const MAX_BULK_ROWS = 500;
const BADGE_TEXT_MAX = 20;

const blankToNull = (v: any): any => {
  if (v === undefined) return undefined; // not sent → leave the field alone
  if (v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  return v;
};

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

// PATCH /variation/bulk — save every row of the Page Content variation table
// in one request, so the form's single top Save covers them like every other
// section. Writes ONLY the three fields that editor owns.
export const patchVariationsBulk: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const rows = req.body?.variations;
    if (!Array.isArray(rows)) {
      throw new ApiError(400, "`variations` must be an array");
    }
    if (rows.length > MAX_BULK_ROWS) {
      throw new ApiError(
        400,
        `Too many variations (${rows.length}). Maximum allowed is ${MAX_BULK_ROWS}.`,
      );
    }

    const clean: BulkVariationRow[] = [];
    for (const r of rows) {
      if (!r?._id) throw new ApiError(400, "Every row needs an _id");

      const row: BulkVariationRow = { _id: String(r._id) };

      if (r.variation_weight_grams !== undefined) {
        const w = blankToNull(r.variation_weight_grams);
        if (w === null) {
          row.variation_weight_grams = null;
        } else {
          const n = Number(w);
          if (!Number.isFinite(n) || n < 0) {
            throw new ApiError(400, `Invalid weight on variation ${r._id}`);
          }
          row.variation_weight_grams = Math.round(n);
        }
      }

      if (r.variation_badge_text !== undefined) {
        const t = blankToNull(r.variation_badge_text);
        // maxLength on the admin input is client-side only.
        row.variation_badge_text =
          t === null ? null : String(t).trim().slice(0, BADGE_TEXT_MAX);
      }

      if (r.variation_badge_icon_key !== undefined) {
        const k = blankToNull(r.variation_badge_icon_key);
        row.variation_badge_icon_key = k === null ? null : String(k);
      }

      clean.push(row);
    }

    const result = await bulkUpdateVariationsService(clean);

    // A row goes missing when another admin deleted that variation while this
    // form was open. The service writes nothing in that case, so this is an
    // honest "nothing was saved" — not a partial write dressed up as an error.
    if (result.missingIds.length) {
      throw new ApiError(
        409,
        `${result.missingIds.length} variation(s) no longer exist — nothing was saved. Reload the page and try again.`,
      );
    }

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: `${result.modified} variation(s) updated`,
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
