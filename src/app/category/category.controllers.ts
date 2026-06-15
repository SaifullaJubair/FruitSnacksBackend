import { NextFunction, Request, RequestHandler, Response } from "express";
import {
  categorySearchableField,
  ICategoryInterface,
} from "./category.interface";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { stripDemoFlag } from "../../helpers/stripDemoFlag";
import {
  categoryHasChildrenServices,
  categoryHasProductsServices,
  deleteCategoryServices,
  findAllCategoryServices,
  findAllDashboardCategoryServices,
  getCategoryBreadcrumbServices,
  getCategoryChildrenServices,
  getCategoryTreeServices,
  getReparentImpactServices,
  getSixFeaturedCategoryServices,
  postCategoryServices,
  resolveCategoryDefaults,
  updateCategoryServices,
} from "./category.services";
import { FileUploadHelper } from "../../helpers/image.upload";
import ApiError from "../../errors/ApiError";
import * as fs from "fs";
import CategoryModel from "./category.model";

// Phase B — normalize default_*_attributes arrays from multipart/JSON bodies.
// Admin sends these as JSON-stringified arrays inside multipart form-data
// (multer collapses repeated keys to the last value, so we can't rely on
// repeated-key arrays here). Pure JSON requests send a real array directly.
// "" / "[]" → explicit empty; missing → leave alone (don't wipe existing).
const normalizeAttributeArrays = (body: any): void => {
  for (const key of [
    "default_variant_attributes",
    "default_filter_attributes",
  ]) {
    const raw = body?.[key];
    if (raw === undefined || raw === null) continue;
    if (Array.isArray(raw)) {
      body[key] = raw
        .map((v: any) => (typeof v === "string" ? v.trim() : v))
        .filter((v: any) => v);
      continue;
    }
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed || trimmed === "[]") {
        body[key] = [];
        continue;
      }
      // Try JSON parse first (admin form sends stringified array).
      if (trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            body[key] = parsed
              .map((v: any) => (typeof v === "string" ? v.trim() : v))
              .filter((v: any) => v);
            continue;
          }
        } catch (_e) {
          // fall through
        }
      }
      // Fallback: treat as single id.
      body[key] = [trimmed];
    }
  }
};

// Get the full nested category tree (root nodes with nested children)
export const getCategoryTree: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ICategoryInterface | any> => {
  try {
    const includeInactive = req.query?.includeInactive === "true";
    const result: any = await getCategoryTreeServices(includeInactive);
    return sendResponse<ICategoryInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Category Tree Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Get direct children of one node (drill-down). :id = node id, or "root".
export const getCategoryChildren: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ICategoryInterface | any> => {
  try {
    const result: any = await getCategoryChildrenServices(req.params.id);
    return sendResponse<ICategoryInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Category Children Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Get breadcrumb (ancestors root → … → node) for a node.
export const getCategoryBreadcrumb: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ICategoryInterface | any> => {
  try {
    const result: any = await getCategoryBreadcrumbServices(req.params.id);
    return sendResponse<ICategoryInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Category Breadcrumb Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// M24 — re-parent impact preview (descendant + product counts) for confirm dialog.
export const getReparentImpact: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const result = await getReparentImpactServices(req.params.id);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Re-parent impact computed",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Get six featured category
export const getSixFeaturedCategory: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ICategoryInterface | any> => {
  try {
    const result: any = await getSixFeaturedCategoryServices();
    return sendResponse<ICategoryInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Six Featured Category Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Add A Category
export const postCategory: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ICategoryInterface | any> => {
  try {
    if (
      req.files &&
      ("category_logo" in req.files || "category_video" in req.files) &&
      req.body
    ) {
      const requestData = stripDemoFlag(req.body);
      normalizeAttributeArrays(requestData);
      const findCategoryNameExit: boolean | null | undefined | any =
        await CategoryModel.exists({
          category_slug: requestData?.category_slug,
        });
      if (findCategoryNameExit) {
        if (req.files.category_logo[0]) {
          fs.unlinkSync(req.files.category_logo[0].path);
        } else {
          fs.unlinkSync(req.files.category_video[0].path);
        }
        throw new ApiError(400, "Already Added !");
      }
      const findCategorySerialExit: boolean | null | undefined | any =
        await CategoryModel.exists({
          category_serial: requestData?.category_serial,
          parent_id: requestData?.parent_id || null,
        });
      if (findCategorySerialExit) {
        if (req.files.category_logo[0]) {
          fs.unlinkSync(req.files.category_logo[0].path);
        } else {
          fs.unlinkSync(req.files.category_video[0].path);
        }
        throw new ApiError(400, "Serial Number Previously Added !");
      }
      if (
        requestData?.feature_category_show == true ||
        requestData?.feature_category_show == "true"
      ) {
        const findFeatureCategoryIsMoreThanSix =
          await CategoryModel.countDocuments({
            feature_category_show: true,
            category_status: "active",
          });
        if (findFeatureCategoryIsMoreThanSix >= 6) {
          if (req.files.category_logo[0]) {
            fs.unlinkSync(req.files.category_logo[0].path);
          } else {
            fs.unlinkSync(req.files.category_video[0].path);
          }
          throw new ApiError(400, "Already 6 Feature Selected !");
        }
      }
      if (
        requestData?.explore_category_show == true ||
        requestData?.explore_category_show == "true"
      ) {
        const findExploreCategoryIsMoreThanSix =
          await CategoryModel.countDocuments({
            explore_category_show: true,
            category_status: "active",
          });
        if (findExploreCategoryIsMoreThanSix >= 3) {
          if (req.files.category_logo[0]) {
            fs.unlinkSync(req.files.category_logo[0].path);
          } else {
            fs.unlinkSync(req.files.category_video[0].path);
          }
          throw new ApiError(400, "Already 3 Explore Selected !");
        }
      }
      // get the category image and upload
      let category_logo;
      let category_logo_key;
      let category_video;
      let category_video_key;
      if (req.files && "category_logo" in req.files) {
        const categoryImage = req.files["category_logo"][0];
        const category_logo_upload = await FileUploadHelper.uploadToSpaces(
          categoryImage
        );
        category_logo = category_logo_upload?.Location;
        category_logo_key = category_logo_upload?.Key;
      }
      if (req.files && "category_video" in req.files) {
        const categoryVideo = req.files["category_video"][0];
        const category_video_upload = await FileUploadHelper.VideoUploader(
          categoryVideo
        );
        category_video = category_video_upload?.Location;
        category_video_key = category_video_upload?.Key;
      }
      const data = { ...requestData };
      if (category_logo) {
        data.category_logo = category_logo;
        data.category_logo_key = category_logo_key;
      }
      if (category_video) {
        data.category_video = category_video;
        data.category_video_key = category_video_key;
      }
      const result: ICategoryInterface | {} = await postCategoryServices(data);
      if (result) {
        return sendResponse<ICategoryInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Category Added Successfully !",
        });
      } else {
        throw new ApiError(400, "Category Added Failed !");
      }
    } else {
      // No file uploaded — child/leaf nodes in the tree may have no logo/video.
      const requestData = stripDemoFlag(req.body);
      normalizeAttributeArrays(requestData);
      if (!requestData?.category_name || !requestData?.category_slug) {
        throw new ApiError(400, "Category name and slug are required");
      }
      const findCategoryNameExit = await CategoryModel.exists({
        category_slug: requestData?.category_slug,
      });
      if (findCategoryNameExit) {
        throw new ApiError(400, "Already Added !");
      }
      const findCategorySerialExit = await CategoryModel.exists({
        category_serial: requestData?.category_serial,
        parent_id: requestData?.parent_id || null,
      });
      if (findCategorySerialExit) {
        throw new ApiError(400, "Serial Number Previously Added !");
      }
      if (
        requestData?.feature_category_show == true ||
        requestData?.feature_category_show == "true"
      ) {
        const featureCount = await CategoryModel.countDocuments({
          feature_category_show: true,
          category_status: "active",
        });
        if (featureCount >= 6) {
          throw new ApiError(400, "Already 6 Feature Selected !");
        }
      }
      if (
        requestData?.explore_category_show == true ||
        requestData?.explore_category_show == "true"
      ) {
        const exploreCount = await CategoryModel.countDocuments({
          explore_category_show: true,
          category_status: "active",
        });
        if (exploreCount >= 3) {
          throw new ApiError(400, "Already 3 Explore Selected !");
        }
      }
      const result: ICategoryInterface | {} = await postCategoryServices(
        requestData
      );
      if (result) {
        return sendResponse<ICategoryInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Category Added Successfully !",
        });
      } else {
        throw new ApiError(400, "Category Added Failed !");
      }
    }
  } catch (error: any) {
    next(error);
  }
};

// Find All Category
export const findAllCategory: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ICategoryInterface | any> => {
  try {
    const result: ICategoryInterface[] | any = await findAllCategoryServices();
    return sendResponse<ICategoryInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Category Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All dashboard Category
export const findAllDashboardCategory: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ICategoryInterface | any> => {
  try {
    const { page, limit, searchTerm } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: ICategoryInterface[] | any =
      await findAllDashboardCategoryServices(limitNumber, skip, searchTerm);
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: categorySearchableField.map((field) => ({
          [field]: {
            $regex: searchTerm,
            $options: "i",
          },
        })),
      });
    }
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await CategoryModel.countDocuments(whereCondition);
    return sendResponse<ICategoryInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Category Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update A Category
export const updateCategory: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ICategoryInterface | any> => {
  try {
    if (
      req.files &&
      ("category_logo" in req.files || "category_video" in req.files) &&
      req.body
    ) {
      const requestData = stripDemoFlag(req.body);
      normalizeAttributeArrays(requestData);
      const findCategoryNameExit: boolean | null | undefined | any =
        await CategoryModel.exists({
          category_slug: requestData?.category_slug,
        });
      if (
        findCategoryNameExit &&
        requestData?._id !== findCategoryNameExit?._id.toString()
      ) {
        if (req.files.category_logo[0]) {
          fs.unlinkSync(req.files.category_logo[0].path);
        } else {
          fs.unlinkSync(req.files.category_video[0].path);
        }
        throw new ApiError(400, "Already Added !");
      }
      // Sibling-scoped serial check. Re-parent path resolves new sibling list
      // inside updateCategoryServices (auto-resolves any collision), so SKIP
      // the pre-check entirely when caller is changing parent_id — otherwise
      // admin gets a confusing "serial already added" error when re-parenting.
      const existingDoc: any = requestData?._id
        ? await CategoryModel.findById(requestData._id)
            .select("parent_id")
            .lean()
        : null;
      const isReparentRequest =
        Object.prototype.hasOwnProperty.call(requestData || {}, "parent_id") &&
        String(requestData?.parent_id ?? "") !==
          String(existingDoc?.parent_id ?? "");
      if (!isReparentRequest) {
        const findCategorySerialExit: boolean | null | undefined | any =
          await CategoryModel.exists({
            category_serial: requestData?.category_serial,
            parent_id: existingDoc?.parent_id || null,
            _id: { $ne: requestData?._id },
          });
        if (findCategorySerialExit) {
          if (req.files.category_logo[0]) {
            fs.unlinkSync(req.files.category_logo[0].path);
          } else {
            fs.unlinkSync(req.files.category_video[0].path);
          }
          throw new ApiError(400, "Serial Number Previously Added !");
        }
      }

      // Multipart bodies coerce booleans to strings, so check both forms.
      // Without `== "true"` the cap check is silently skipped in this branch
      // and admin can exceed the featured/explore limits via image-upload PATCH.
      if (
        requestData?.feature_category_show == true ||
        requestData?.feature_category_show == "true"
      ) {
        const findFeatureCategoryIsMoreThanSix = await CategoryModel.find({
          feature_category_show: true,
          category_status: "active",
          _id: { $ne: requestData?._id },
        }).select("_id");
        if (findFeatureCategoryIsMoreThanSix?.length >= 6) {
          if (req.files.category_logo[0]) {
            fs.unlinkSync(req.files.category_logo[0].path);
          } else {
            fs.unlinkSync(req.files.category_video[0].path);
          }
          throw new ApiError(400, "Already 6 Selected !");
        }
      }
      if (
        requestData?.explore_category_show == true ||
        requestData?.explore_category_show == "true"
      ) {
        const findExploreCategoryIsMoreThanThree = await CategoryModel.find({
          explore_category_show: true,
          category_status: "active",
          _id: { $ne: requestData?._id },
        }).select("_id");
        if (findExploreCategoryIsMoreThanThree?.length >= 3) {
          if (req.files.category_logo[0]) {
            fs.unlinkSync(req.files.category_logo[0].path);
          } else {
            fs.unlinkSync(req.files.category_video[0].path);
          }
          throw new ApiError(400, "Already 3 Selected !");
        }
      }
      // get the category image and upload
      // get the category image and upload
      let category_logo;
      let category_logo_key;
      let category_video;
      let category_video_key;
      if (req.files && "category_logo" in req.files) {
        const categoryImage = req.files["category_logo"][0];
        const category_logo_upload = await FileUploadHelper.uploadToSpaces(
          categoryImage
        );
        category_logo = category_logo_upload?.Location;
        category_logo_key = category_logo_upload?.Key;
      }
      if (req.files && "category_video" in req.files) {
        const categoryImage = req.files["category_video"][0];
        const category_video_upload = await FileUploadHelper.VideoUploader(
          categoryImage
        );
        category_video = category_video_upload?.Location;
        category_video_key = category_video_upload?.Key;
      }
      const data = { ...requestData };
      if (category_logo) {
        data.category_logo = category_logo;
        data.category_logo_key = category_logo_key;
      }
      if (category_video) {
        data.category_video = category_video;
        data.category_video_key = category_video_key;
      }
      const result: ICategoryInterface | any = await updateCategoryServices(
        data,
        requestData?._id
      );
      if (result?.modifiedCount > 0) {
        if (req.body?.category_logo_key) {
          await FileUploadHelper.deleteFromSpaces(req.body?.category_logo_key);
        }
        if (req.body?.category_video_key) {
          await FileUploadHelper.deleteFromSpaces(req.body?.category_video_key);
        }
        return sendResponse<ICategoryInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Category Update Successfully !",
        });
      } else {
        throw new ApiError(400, "Category Update Failed !");
      }
    } else {
      const requestData = stripDemoFlag(req.body);
      normalizeAttributeArrays(requestData);
      const findCategoryNameExit: boolean | null | undefined | any =
        await CategoryModel.exists({
          category_slug: requestData?.category_slug,
        });
      if (
        findCategoryNameExit &&
        requestData?._id !== findCategoryNameExit?._id.toString()
      ) {
        throw new ApiError(400, "Already Added !");
      }
      // Sibling-scoped serial check (no-file branch). Re-parent path resolves
      // new sibling list inside updateCategoryServices (auto-resolves any
      // collision), so SKIP the pre-check entirely when caller is changing
      // parent_id — otherwise admin gets a confusing "serial already added"
      // error when re-parenting.
      const existingDocNoFile: any = requestData?._id
        ? await CategoryModel.findById(requestData._id)
            .select("parent_id")
            .lean()
        : null;
      const isReparentRequestNoFile =
        Object.prototype.hasOwnProperty.call(requestData || {}, "parent_id") &&
        String(requestData?.parent_id ?? "") !==
          String(existingDocNoFile?.parent_id ?? "");
      if (!isReparentRequestNoFile) {
        const findCategorySerialExit: boolean | null | undefined | any =
          await CategoryModel.exists({
            category_serial: requestData?.category_serial,
            parent_id: existingDocNoFile?.parent_id || null,
            _id: { $ne: requestData?._id },
          });
        if (findCategorySerialExit) {
          throw new ApiError(400, "Serial Number Previously Added !");
        }
      }
      if (requestData?.feature_category_show == true) {
        const findFeatureCategoryIsMoreThanSix = await CategoryModel.find({
          feature_category_show: true,
          category_status: "active",
          _id: { $ne: requestData?._id },
        }).select("_id");
        if (findFeatureCategoryIsMoreThanSix?.length >= 6) {
          throw new ApiError(400, "Already 6 Selected !");
        }
      }
      if (requestData?.explore_category_show == true) {
        const findFeatureCategoryIsMoreThanSix = await CategoryModel.find({
          explore_category_show: true,
          category_status: "active",
          _id: { $ne: requestData?._id },
        }).select("_id");
        if (findFeatureCategoryIsMoreThanSix?.length >= 3) {
          throw new ApiError(400, "Already 3 Selected !");
        }
      }
      const result: ICategoryInterface | any = await updateCategoryServices(
        requestData,
        requestData?._id
      );
      if (result?.modifiedCount > 0) {
        return sendResponse<ICategoryInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Category Update Successfully !",
        });
      } else {
        throw new ApiError(400, "Category Update Failed !");
      }
    }
  } catch (error: any) {
    next(error);
  }
};

// Phase B — resolved category defaults (parent-merged, dead-ref filtered).
// Public endpoint — used by admin product form for auto-apply + by storefront
// filter sidebar fallback. Returns hydrated attribute docs (not just ids) so
// the consumer doesn't need a second populate round-trip.
export const getCategoryDefaults: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<ICategoryInterface | any> => {
  try {
    const result = await resolveCategoryDefaults(req.params.id);
    return sendResponse<any>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Category defaults resolved successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// delete A Category item
export const deleteACategoryInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const category_id = req.body._id;
    // Tree integrity: a node can only be deleted if it is a leaf (no child
    // categories) and no product is assigned to it.
    if (await categoryHasChildrenServices(category_id)) {
      throw new ApiError(
        400,
        "This category has sub-categories. Delete or move them first."
      );
    }
    if (await categoryHasProductsServices(category_id)) {
      throw new ApiError(400, "Products are assigned to this category.");
    }
    const result = await deleteCategoryServices(category_id);
    if (result?.deletedCount > 0) {
      if (req.body?.category_logo_key) {
        await FileUploadHelper.deleteFromSpaces(req.body?.category_logo_key);
      }
      if (req.body?.category_video_key) {
        await FileUploadHelper.deleteFromSpaces(req.body?.category_video_key);
      }
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Category Delete successfully !",
      });
    } else {
      throw new ApiError(400, "Category delete failed !");
    }
  } catch (error) {
    next(error);
  }
};
