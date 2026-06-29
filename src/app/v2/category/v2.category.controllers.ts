import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import * as fs from "fs";

import sendResponse from "../../../shared/sendResponse";
import ApiError from "../../../errors/ApiError";
import { ERROR_CODES } from "../../../shared/apiEnvelope";
import { FileUploadHelper } from "../../../helpers/image.upload";
import { stripDemoFlag } from "../../../helpers/stripDemoFlag";
import { slugify } from "../../product/product.allId";

import CategoryModel from "../../category/category.model";
import { categorySearchableField } from "../../category/category.interface";
import {
  postCategoryServices,
  updateCategoryServices,
  deleteCategoryServices,
  getCategoryTreeServices,
  getReparentImpactServices,
  categoryHasChildrenServices,
  categoryHasProductsServices,
} from "../../category/category.services";

interface AuthRequest extends Request {
  userId?: string;
}

const FEATURE_CAP = 6;
const EXPLORE_CAP = 3;

// Clean temp multer files (logo + video) when a request fails before/after S3.
const cleanTemp = (req: Request) => {
  for (const key of ["category_logo", "category_video"]) {
    const f = (req.files as any)?.[key]?.[0];
    if (f?.path) {
      try {
        fs.unlinkSync(f.path);
      } catch {
        /* gone */
      }
    }
  }
};

const asBool = (v: unknown) => v === true || v === "true";

// ── LIST — flat paginated + §9.1 meta (admin table) ─────────────────────────
export const v2CategoryList: RequestHandler = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 20);
    const skip = (page - 1) * limit;
    const search = (req.query.search as string)?.trim();
    const status = req.query.status as string;
    const sort = (req.query.sort as string) || "category_serial";

    const and: any[] = [];
    if (search) {
      and.push({
        $or: categorySearchableField.map((f) => ({
          [f]: { $regex: search, $options: "i" },
        })),
      });
    }
    if (status) and.push({ category_status: status });
    const where = and.length ? { $and: and } : {};

    const [rows, total] = await Promise.all([
      CategoryModel.find(where).sort(sort).skip(skip).limit(limit).select("-__v").lean(),
      CategoryModel.countDocuments(where),
    ]);

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Categories fetched",
      data: rows,
      total,
      page,
      limit,
    });
  } catch (error) {
    next(error);
  }
};

// ── TREE — full nested tree (for tree-view / parent picker) ─────────────────
export const v2CategoryTree: RequestHandler = async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const tree = await getCategoryTreeServices(includeInactive);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Category tree fetched",
      data: tree,
    });
  } catch (error) {
    next(error);
  }
};

// ── RE-PARENT IMPACT — counts for the confirm dialog ────────────────────────
export const v2CategoryReparentImpact: RequestHandler = async (req, res, next) => {
  try {
    const impact = await getReparentImpactServices(req.params.id);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Impact computed",
      data: impact,
    });
  } catch (error) {
    next(error);
  }
};

// shared cap + sibling-serial validation (scoped to parent). Throws CONFLICT.
const assertCategoryConstraints = async (
  data: {
    category_slug?: string;
    category_serial?: number;
    parent_id?: string | null;
    feature_category_show?: boolean;
    explore_category_show?: boolean;
  },
  excludeId?: string,
) => {
  const ne = excludeId ? { _id: { $ne: excludeId } } : {};
  if (data.category_slug) {
    const dupSlug = await CategoryModel.exists({ category_slug: data.category_slug, ...ne });
    if (dupSlug)
      throw new ApiError(httpStatus.CONFLICT, "A category with this slug already exists", ERROR_CODES.CONFLICT, [
        { path: "category_slug", message: "Slug already in use" },
      ]);
  }
  // serial is sibling-scoped (per parent).
  if (data.category_serial !== undefined) {
    const dupSerial = await CategoryModel.exists({
      category_serial: data.category_serial,
      parent_id: data.parent_id ?? null,
      ...ne,
    });
    if (dupSerial)
      throw new ApiError(httpStatus.CONFLICT, "This serial is already used by a sibling category", ERROR_CODES.CONFLICT, [
        { path: "category_serial", message: "Serial already in use" },
      ]);
  }
  // caps exclude inactive (edge H3 — both branches now correct).
  if (data.feature_category_show) {
    const shown = await CategoryModel.countDocuments({
      feature_category_show: true,
      category_status: "active",
      ...ne,
    });
    if (shown >= FEATURE_CAP)
      throw new ApiError(httpStatus.CONFLICT, `Only ${FEATURE_CAP} featured categories allowed`, ERROR_CODES.CONFLICT, [
        { path: "feature_category_show", message: `Max ${FEATURE_CAP} reached` },
      ]);
  }
  if (data.explore_category_show) {
    const shown = await CategoryModel.countDocuments({
      explore_category_show: true,
      category_status: "active",
      ...ne,
    });
    if (shown >= EXPLORE_CAP)
      throw new ApiError(httpStatus.CONFLICT, `Only ${EXPLORE_CAP} explore categories allowed`, ERROR_CODES.CONFLICT, [
        { path: "explore_category_show", message: `Max ${EXPLORE_CAP} reached` },
      ]);
  }
};

const nextSiblingSerial = async (parentId: string | null): Promise<number> => {
  const last = await CategoryModel.findOne({ parent_id: parentId ?? null })
    .sort({ category_serial: -1 })
    .select("category_serial")
    .lean();
  return ((last as any)?.category_serial ?? 0) + 1;
};

// ── CREATE — logo optional, video optional, caps before S3, returns row ─────
export const v2CategoryCreate: RequestHandler = async (req: AuthRequest, res, next) => {
  try {
    const body = stripDemoFlag({ ...req.body });
    const logoFile = (req.files as any)?.category_logo?.[0];
    const videoFile = (req.files as any)?.category_video?.[0];

    if (!body.category_name?.trim()) {
      cleanTemp(req);
      throw new ApiError(httpStatus.BAD_REQUEST, "Category name is required");
    }

    const parent_id = body.parent_id ? String(body.parent_id) : null;
    const category_slug = body.category_slug?.trim() || slugify(body.category_name);
    const category_serial =
      body.category_serial !== undefined && body.category_serial !== ""
        ? Number(body.category_serial)
        : await nextSiblingSerial(parent_id);
    const feature_category_show = asBool(body.feature_category_show);
    const explore_category_show = asBool(body.explore_category_show);

    await assertCategoryConstraints(
      { category_slug, category_serial, parent_id, feature_category_show, explore_category_show },
      undefined,
    ).catch((e) => {
      cleanTemp(req);
      throw e;
    });

    let category_logo, category_logo_key, category_video, category_video_key;
    if (logoFile) {
      const up = await FileUploadHelper.uploadToSpaces(logoFile);
      category_logo = up?.Location;
      category_logo_key = up?.Key;
    }
    if (videoFile) {
      const up = await FileUploadHelper.uploadToSpaces(videoFile);
      category_video = up?.Location;
      category_video_key = up?.Key;
    }

    // postCategoryServices auto-computes parent_id/depth/category_path.
    const created: any = await postCategoryServices({
      category_name: body.category_name.trim(),
      category_slug,
      category_serial,
      parent_id,
      feature_category_show,
      explore_category_show,
      category_status: body.category_status || "active",
      category_logo,
      category_logo_key,
      category_video,
      category_video_key,
      category_publisher_id: req.userId,
    } as any);

    const row = await CategoryModel.findById(created._id).select("-__v").lean();
    return sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Category created",
      data: row,
    });
  } catch (error) {
    next(error);
  }
};

// ── UPDATE — :id param; re-parent cascade handled by V1 service; returns row ─
export const v2CategoryUpdate: RequestHandler = async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const body = stripDemoFlag({ ...req.body });
    const logoFile = (req.files as any)?.category_logo?.[0];
    const videoFile = (req.files as any)?.category_video?.[0];

    const existing: any = await CategoryModel.findById(id).lean();
    if (!existing) {
      cleanTemp(req);
      throw new ApiError(httpStatus.NOT_FOUND, "Category not found");
    }

    const patch: any = { category_updated_by: req.userId };
    if (body.category_name?.trim()) patch.category_name = body.category_name.trim();
    if (body.category_slug?.trim()) patch.category_slug = body.category_slug.trim();
    if (body.category_status) patch.category_status = body.category_status;
    if (body.category_serial !== undefined && body.category_serial !== "")
      patch.category_serial = Number(body.category_serial);
    if (body.feature_category_show !== undefined)
      patch.feature_category_show = asBool(body.feature_category_show);
    if (body.explore_category_show !== undefined)
      patch.explore_category_show = asBool(body.explore_category_show);
    // re-parent intent: only when caller explicitly sends parent_id.
    const reparenting = Object.prototype.hasOwnProperty.call(body, "parent_id");
    if (reparenting) patch.parent_id = body.parent_id ? String(body.parent_id) : null;

    // caps/slug validated against the EFFECTIVE parent (new if re-parenting).
    await assertCategoryConstraints(
      {
        category_slug: patch.category_slug,
        feature_category_show: patch.feature_category_show,
        explore_category_show: patch.explore_category_show,
        parent_id: reparenting ? patch.parent_id : existing.parent_id ? String(existing.parent_id) : null,
      },
      id,
    ).catch((e) => {
      cleanTemp(req);
      throw e;
    });

    if (logoFile) {
      const up = await FileUploadHelper.uploadToSpaces(logoFile);
      patch.category_logo = up?.Location;
      patch.category_logo_key = up?.Key;
    }
    if (videoFile) {
      const up = await FileUploadHelper.uploadToSpaces(videoFile);
      patch.category_video = up?.Location;
      patch.category_video_key = up?.Key;
    }

    // updateCategoryServices handles the re-parent cascade transactionally.
    await updateCategoryServices(patch, id);

    // delete old media AFTER a successful update (edge H4).
    if (logoFile && existing.category_logo_key)
      await FileUploadHelper.deleteFromSpaces(existing.category_logo_key);
    if (videoFile && existing.category_video_key)
      await FileUploadHelper.deleteFromSpaces(existing.category_video_key);

    const row = await CategoryModel.findById(id).select("-__v").lean();
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Category updated",
      data: row,
    });
  } catch (error) {
    next(error);
  }
};

// ── DELETE — leaf-only + no-products guards (edge H6), S3 cleanup ───────────
export const v2CategoryDelete: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing: any = await CategoryModel.findById(id).lean();
    if (!existing) throw new ApiError(httpStatus.NOT_FOUND, "Category not found");

    if (await categoryHasChildrenServices(id))
      throw new ApiError(
        httpStatus.CONFLICT,
        "This category has sub-categories. Delete or move them first.",
        ERROR_CODES.CONFLICT,
      );
    if (await categoryHasProductsServices(id))
      throw new ApiError(
        httpStatus.CONFLICT,
        "Products are assigned to this category.",
        ERROR_CODES.CONFLICT,
      );

    await deleteCategoryServices(id);
    if (existing.category_logo_key)
      await FileUploadHelper.deleteFromSpaces(existing.category_logo_key);
    if (existing.category_video_key)
      await FileUploadHelper.deleteFromSpaces(existing.category_video_key);

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Category deleted",
      data: { id },
    });
  } catch (error) {
    next(error);
  }
};

// ── REORDER — bulkWrite category_serial (sibling-scoped via items) ──────────
export const v2CategoryReorder: RequestHandler = async (req, res, next) => {
  try {
    const items: { id: string; position: number }[] = req.body?.items || [];
    if (!Array.isArray(items) || !items.length)
      throw new ApiError(httpStatus.BAD_REQUEST, "items array required");

    await CategoryModel.bulkWrite(
      items.map((it) => ({
        updateOne: {
          filter: { _id: it.id },
          update: { $set: { category_serial: it.position } },
        },
      })),
    );

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Categories reordered",
      data: { count: items.length },
    });
  } catch (error) {
    next(error);
  }
};
