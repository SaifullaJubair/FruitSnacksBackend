import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import * as fs from "fs";

import sendResponse from "../../../shared/sendResponse";
import ApiError from "../../../errors/ApiError";
import { ERROR_CODES } from "../../../shared/apiEnvelope";
import { FileUploadHelper } from "../../../helpers/image.upload";
import { stripDemoFlag } from "../../../helpers/stripDemoFlag";
import { slugify } from "../../product/product.allId";

import BrandModel from "../../brand/brand.model";
import ProductModel from "../../product/product.model";
import { brandSearchableField } from "../../brand/brand.interface";

interface AuthRequest extends Request {
  userId?: string;
}

const BRAND_SHOW_CAP = 12;

// Clean a temp multer file if the request fails before/after S3 (no orphan temp).
const cleanTemp = (req: Request) => {
  const f = (req.files as any)?.brand_logo?.[0];
  if (f?.path) {
    try {
      fs.unlinkSync(f.path);
    } catch {
      /* already gone */
    }
  }
};

// ── LIST — paginated + §9.1 meta (A1) ────────────────────────────────────────
export const v2BrandList: RequestHandler = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 20);
    const skip = (page - 1) * limit;
    const search = (req.query.search as string)?.trim();
    const status = req.query.status as string;
    const sort = (req.query.sort as string) || "-createdAt";

    const and: any[] = [];
    if (search) {
      and.push({
        $or: brandSearchableField.map((f) => ({
          [f]: { $regex: search, $options: "i" },
        })),
      });
    }
    if (status) and.push({ brand_status: status });
    const where = and.length ? { $and: and } : {};

    const [rows, total] = await Promise.all([
      BrandModel.find(where)
        .populate("category_id")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select("-__v")
        .lean(),
      BrandModel.countDocuments(where),
    ]);

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Brands fetched",
      data: rows,
      total,
      page,
      limit,
    });
  } catch (error) {
    next(error);
  }
};

// shared validation: slug + serial uniqueness, brand_show cap. Throws CONFLICT.
const assertBrandConstraints = async (
  data: { brand_slug?: string; brand_serial?: number; brand_show?: boolean },
  excludeId?: string,
) => {
  const ne = excludeId ? { _id: { $ne: excludeId } } : {};
  if (data.brand_slug) {
    const dupSlug = await BrandModel.exists({ brand_slug: data.brand_slug, ...ne });
    if (dupSlug)
      throw new ApiError(httpStatus.CONFLICT, "A brand with this slug already exists", ERROR_CODES.CONFLICT, [
        { path: "brand_slug", message: "Slug already in use" },
      ]);
  }
  if (data.brand_serial !== undefined) {
    const dupSerial = await BrandModel.exists({ brand_serial: data.brand_serial, ...ne });
    if (dupSerial)
      throw new ApiError(httpStatus.CONFLICT, "This serial number is already in use", ERROR_CODES.CONFLICT, [
        { path: "brand_serial", message: "Serial already in use" },
      ]);
  }
  if (data.brand_show === true) {
    const shown = await BrandModel.countDocuments({ brand_show: true, ...ne });
    if (shown >= BRAND_SHOW_CAP)
      throw new ApiError(httpStatus.CONFLICT, `Only ${BRAND_SHOW_CAP} brands can be shown on the homepage`, ERROR_CODES.CONFLICT, [
        { path: "brand_show", message: `Max ${BRAND_SHOW_CAP} reached` },
      ]);
  }
};

// next free brand_serial (auto-assign when form omits it).
const nextSerial = async (): Promise<number> => {
  const last = await BrandModel.findOne().sort({ brand_serial: -1 }).select("brand_serial").lean();
  return ((last as any)?.brand_serial ?? 0) + 1;
};

// ── CREATE (A2) — logo required, caps BEFORE S3, publisher from JWT, returns row
export const v2BrandCreate: RequestHandler = async (req: AuthRequest, res, next) => {
  try {
    const body = stripDemoFlag({ ...req.body });
    const file = (req.files as any)?.brand_logo?.[0];

    if (!body.brand_name?.trim()) {
      cleanTemp(req);
      throw new ApiError(httpStatus.BAD_REQUEST, "Brand name is required");
    }
    if (!file) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Brand logo is required");
    }

    const brand_slug = body.brand_slug?.trim() || slugify(body.brand_name);
    const brand_serial =
      body.brand_serial !== undefined && body.brand_serial !== ""
        ? Number(body.brand_serial)
        : await nextSerial();
    const brand_show = body.brand_show === true || body.brand_show === "true";

    // caps + uniqueness BEFORE uploading to S3 (edge M1 — no orphan on reject)
    await assertBrandConstraints({ brand_slug, brand_serial, brand_show }, undefined).catch((e) => {
      cleanTemp(req);
      throw e;
    });

    const upload = await FileUploadHelper.uploadToSpaces(file);

    const created = await BrandModel.create({
      brand_name: body.brand_name.trim(),
      brand_slug,
      brand_serial,
      brand_show,
      brand_status: body.brand_status || "active",
      brand_logo: upload?.Location,
      brand_logo_key: upload?.Key,
      brand_publisher_id: req.userId, // from verifyToken, NOT body (edge N4)
    });

    const row = await BrandModel.findById(created._id).populate("category_id").select("-__v").lean();
    return sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Brand created",
      data: row,
    });
  } catch (error) {
    next(error);
  }
};

// ── UPDATE (A3) — :id param, optional new logo, old key from DB, modifiedCount:0=OK
export const v2BrandUpdate: RequestHandler = async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const body = stripDemoFlag({ ...req.body });
    const file = (req.files as any)?.brand_logo?.[0];

    const existing = await BrandModel.findById(id).lean();
    if (!existing) {
      cleanTemp(req);
      throw new ApiError(httpStatus.NOT_FOUND, "Brand not found");
    }

    const patch: any = { brand_updated_by: req.userId };
    if (body.brand_name?.trim()) patch.brand_name = body.brand_name.trim();
    if (body.brand_slug?.trim()) patch.brand_slug = body.brand_slug.trim();
    else if (body.brand_name?.trim()) patch.brand_slug = slugify(body.brand_name);
    if (body.brand_status) patch.brand_status = body.brand_status;
    if (body.brand_serial !== undefined && body.brand_serial !== "")
      patch.brand_serial = Number(body.brand_serial);
    if (body.brand_show !== undefined)
      patch.brand_show = body.brand_show === true || body.brand_show === "true";

    await assertBrandConstraints(patch, id).catch((e) => {
      cleanTemp(req);
      throw e;
    });

    // new logo → upload, then delete the OLD key fetched from DB (edge H4)
    if (file) {
      const upload = await FileUploadHelper.uploadToSpaces(file);
      patch.brand_logo = upload?.Location;
      patch.brand_logo_key = upload?.Key;
    }

    // returns the updated row; modifiedCount:0 (no change) is NOT an error (edge H2)
    const row = await BrandModel.findByIdAndUpdate(id, patch, {
      new: true,
      runValidators: true,
    })
      .populate("category_id")
      .select("-__v")
      .lean();

    if (file && (existing as any).brand_logo_key) {
      await FileUploadHelper.deleteFromSpaces((existing as any).brand_logo_key);
    }

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Brand updated",
      data: row,
    });
  } catch (error) {
    next(error);
  }
};

// ── DELETE (A4) — blocked if used in a product; S3 cleanup
export const v2BrandDelete: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await BrandModel.findById(id).lean();
    if (!existing) throw new ApiError(httpStatus.NOT_FOUND, "Brand not found");

    const usedInProduct = await ProductModel.exists({ brand_id: id });
    if (usedInProduct)
      throw new ApiError(
        httpStatus.CONFLICT,
        "This brand is used by one or more products and cannot be deleted",
        ERROR_CODES.CONFLICT,
      );

    await BrandModel.deleteOne({ _id: id });
    if ((existing as any).brand_logo_key) {
      await FileUploadHelper.deleteFromSpaces((existing as any).brand_logo_key);
    }

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Brand deleted",
      data: { id },
    });
  } catch (error) {
    next(error);
  }
};

// ── REORDER (A5) — one bulkWrite over brand_serial (mounted before /:id)
export const v2BrandReorder: RequestHandler = async (req, res, next) => {
  try {
    const items: { id: string; position: number }[] = req.body?.items || [];
    if (!Array.isArray(items) || !items.length)
      throw new ApiError(httpStatus.BAD_REQUEST, "items array required");

    await BrandModel.bulkWrite(
      items.map((it) => ({
        updateOne: {
          filter: { _id: it.id },
          update: { $set: { brand_serial: it.position } },
        },
      })),
    );

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Brands reordered",
      data: { count: items.length },
    });
  } catch (error) {
    next(error);
  }
};
