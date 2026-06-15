import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import { randomUUID } from "crypto";
import sendResponse from "../../shared/sendResponse";
import ApiError from "../../errors/ApiError";
import { FileUploadHelper } from "../../helpers/image.upload";
import {
  addFloatingAssetService,
  approveThemeService,
  createThemeService,
  deleteThemeService,
  findThemeByIdService,
  listThemesService,
  removeFloatingAssetService,
  updateThemeService,
} from "./theme.services";
import { IThemeInterface } from "./theme.interface";

const parseJSONField = (val: any) => {
  if (typeof val !== "string") return val;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
};

// Normalize multipart payload — colors/typography/etc may arrive as JSON strings
const normalizeBody = (body: any) => {
  return {
    ...body,
    colors: parseJSONField(body?.colors),
    typography: parseJSONField(body?.typography),
    button_style: parseJSONField(body?.button_style),
    preview_data: parseJSONField(body?.preview_data),
  };
};

// POST /theme — multipart, optional thumbnail_preview file
export const postTheme: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data: any = normalizeBody(req.body);

    if (req.files && "thumbnail_preview" in req.files) {
      const file = (req.files as any)["thumbnail_preview"][0];
      const upload = await FileUploadHelper.uploadToSpaces(file);
      data.thumbnail_preview = upload?.Location;
      data.thumbnail_preview_key = upload?.Key;
    }

    const adminId = (req as any)?.user?._id;
    if (adminId) data.created_by = adminId;

    const result = await createThemeService(data);
    return sendResponse<IThemeInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Theme created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// GET /theme — list
export const findAllThemes: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { status, theme_for, search, page, limit } = req.query;
    const result = await listThemesService({
      status: status as string | undefined,
      theme_for: theme_for as string | undefined,
      search: search as string | undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return sendResponse<IThemeInterface[]>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Themes fetched successfully",
      data: result.data as any,
      totalData: result.total,
    });
  } catch (error) {
    next(error);
  }
};

// GET /theme/:id
export const findThemeById: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await findThemeByIdService(req.params.id);
    if (!result) throw new ApiError(404, "Theme not found");
    return sendResponse<IThemeInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Theme fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /theme/:id — multipart, optional thumbnail
export const patchTheme: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data: any = normalizeBody(req.body);

    if (req.files && "thumbnail_preview" in req.files) {
      const existing = await findThemeByIdService(req.params.id);
      const file = (req.files as any)["thumbnail_preview"][0];
      const upload = await FileUploadHelper.uploadToSpaces(file);
      data.thumbnail_preview = upload?.Location;
      data.thumbnail_preview_key = upload?.Key;
      if (existing?.thumbnail_preview_key) {
        await FileUploadHelper.deleteFromSpaces(existing.thumbnail_preview_key);
      }
    }

    const adminId = (req as any)?.user?._id;
    if (adminId) data.updated_by = adminId;

    const result = await updateThemeService(req.params.id, data);
    if (!result || (result as any).matchedCount === 0) {
      throw new ApiError(404, "Theme not found");
    }
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Theme updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /theme/:id (soft archive if unused)
export const deleteTheme: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await deleteThemeService(req.params.id);
    if (result.reason === "not_found") {
      throw new ApiError(404, "Theme not found");
    }
    if (result.reason === "in_use") {
      throw new ApiError(
        400,
        `Theme is used by ${result.used_in_products} product(s). Remove the theme from those products before deleting.`,
      );
    }
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Theme archived successfully",
    });
  } catch (error) {
    next(error);
  }
};

// POST /theme/:id/approve
export const approveTheme: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = (req as any)?.user?._id;
    const result = await approveThemeService(req.params.id, adminId);
    if (!result || (result as any).matchedCount === 0) {
      throw new ApiError(404, "Theme not found");
    }
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Theme approved and activated",
    });
  } catch (error) {
    next(error);
  }
};

// POST /theme/:id/floating-asset
export const postFloatingAsset: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.files || !("asset" in req.files)) {
      throw new ApiError(400, "asset file is required");
    }
    const file = (req.files as any)["asset"][0];
    const upload = await FileUploadHelper.uploadToSpaces(file);

    const meta = normalizeBody(req.body);
    const asset = {
      // Stable id assigned here: $push (used by addFloatingAssetService) bypasses
      // Mongoose subdoc defaults, so the schema's `id: default randomUUID` never
      // fires on insert. Without an id, product-level hide/replace overrides can't
      // target this asset (Replace button disabled). Assign explicitly.
      id: randomUUID(),
      asset_url: upload?.Location,
      asset_key: upload?.Key,
      position: meta.position || "left",
      align: meta.align || "middle",
      section: meta.section || "any",
      animation_type: meta.animation_type || "float",
      animation_speed: meta.animation_speed || "normal",
      size: meta.size || "md",
      opacity: meta.opacity !== undefined ? Number(meta.opacity) : 1,
      hide_on_mobile:
        meta.hide_on_mobile === "false" || meta.hide_on_mobile === false
          ? false
          : true,
    };

    await addFloatingAssetService(req.params.id, asset);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Floating asset added",
      data: asset,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /theme/:id/floating-asset/:index
export const deleteFloatingAsset: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const index = Number(req.params.index);
    const result = await removeFloatingAssetService(req.params.id, index);
    if (!result.modifiedCount) {
      throw new ApiError(404, "Floating asset not found");
    }
    if ((result as any).removed?.asset_key) {
      await FileUploadHelper.deleteFromSpaces((result as any).removed.asset_key);
    }
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Floating asset removed",
    });
  } catch (error) {
    next(error);
  }
};
