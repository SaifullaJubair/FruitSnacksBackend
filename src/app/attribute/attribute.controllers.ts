import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { stripDemoFlag } from "../../helpers/stripDemoFlag";
import {
  attributeSearchableField,
  attributeValuesArray,
  IAttributeInterface,
} from "./attribute.interface";
import AttributeModel from "./attribute.model";
import ProductModel from "../product/product.model";
import {
  countProductsUsingAttribute,
  deleteAttributeServices,
  findAllAttributeServices,
  findAllAttributeUsingCategoryIDServices,
  findAllDashboardAttributeServices,
  postAttributeServices,
  updateAttributeServices,
} from "./attribute.services";

// Phase 0.5 V1 — trim attribute_name, slug, and every attribute_value_name +
// its slug. Reject the request if attribute_name or any value is empty after
// trim. Mutates the request payload so downstream code sees the normalised
// values. Frontend also validates but this is the authoritative line of
// defence (Postman, stale admin clients, etc.).
// `isCreate=true` enforces required fields (attribute_name). On update, only
// validate fields that are actually present in the payload — partial PATCH
// (e.g. status toggle from list view) must pass without sending the full doc.
const sanitizeAttributeValues = (
  requestData: any,
  isCreate: boolean = false,
): void => {
  // 1) Top-level attribute_name + slug. Reject if name is empty after trim.
  if (typeof requestData?.attribute_name === "string") {
    requestData.attribute_name = requestData.attribute_name.trim();
  }
  if (isCreate && !requestData?.attribute_name) {
    throw new ApiError(400, "Attribute name is empty.");
  }
  if (
    !isCreate &&
    requestData?.attribute_name !== undefined &&
    !requestData?.attribute_name
  ) {
    throw new ApiError(400, "Attribute name cannot be empty.");
  }
  if (typeof requestData?.attribute_slug === "string") {
    requestData.attribute_slug = requestData.attribute_slug
      .trim()
      .replace(/^-+|-+$/g, ""); // strip leading/trailing dashes from slug
  }

  // 3) Phase A — display_type validation. Accept enum or leave as-is so the
  // schema default kicks in for fresh attributes that didn't send the field.
  const ALLOWED_DISPLAY = ["swatch", "button", "dropdown"];
  if (
    requestData?.display_type !== undefined &&
    requestData?.display_type !== null &&
    requestData?.display_type !== "" &&
    !ALLOWED_DISPLAY.includes(requestData.display_type)
  ) {
    throw new ApiError(
      400,
      `Invalid display_type "${requestData.display_type}" — must be one of: ${ALLOWED_DISPLAY.join(", ")}.`,
    );
  }

  // Phase A — coerce tracks_weight to a real boolean (form may send "true"/
  // "false" strings from multipart, or undefined when admin didn't touch it).
  if (requestData?.tracks_weight !== undefined) {
    requestData.tracks_weight =
      requestData.tracks_weight === true ||
      requestData.tracks_weight === "true";
  }

  // 4) Per-value name + slug + weight.
  if (!Array.isArray(requestData?.attribute_values)) return;
  for (let i = 0; i < requestData.attribute_values.length; i++) {
    const row = requestData.attribute_values[i];
    if (typeof row?.attribute_value_name === "string") {
      row.attribute_value_name = row.attribute_value_name.trim();
    }
    if (!row?.attribute_value_name) {
      throw new ApiError(
        400,
        `Attribute value #${i + 1} is empty — every value needs a name.`,
      );
    }
    if (typeof row?.attribute_value_slug === "string") {
      row.attribute_value_slug = row.attribute_value_slug
        .trim()
        .replace(/^-+|-+$/g, "");
    }

    // Phase A — weight_grams_value: accept positive Number or null. Empty
    // string from form → null. Negative rejected (nonsense for weight).
    if (
      row?.weight_grams_value === "" ||
      row?.weight_grams_value === undefined
    ) {
      row.weight_grams_value = null;
    } else if (row?.weight_grams_value !== null) {
      const n = Number(row.weight_grams_value);
      if (!Number.isFinite(n) || n < 0) {
        throw new ApiError(
          400,
          `Attribute value #${i + 1} weight must be a non-negative number.`,
        );
      }
      row.weight_grams_value = n;
    }
  }
};

// Add A Attribute
export const postAttribute: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IAttributeInterface | any> => {
  try {
    const requestData = stripDemoFlag(req.body);

    // Phase 0.5 V1 — empty / whitespace-only value rejection.
    // isCreate=true → attribute_name is mandatory.
    sanitizeAttributeValues(requestData, true);

    const findAttributeNameExit: boolean | null | undefined | any =
      await AttributeModel.exists({
        $and: [
          { attribute_slug: requestData?.attribute_slug },
          // { category_id: requestData?.category_id },
        ],
      });

    if (findAttributeNameExit) {
      throw new ApiError(400, "Already Added !");
    }

    // `attribute_values` থেকে `attribute_value_slug` গুলো সংগ্রহ করা হচ্ছে
    const AttributeValueSlugs = requestData?.attribute_values?.map(
      (item: attributeValuesArray) => item?.attribute_value_slug
    );

    // যদি ডুপ্লিকেট স্লাগ থাকে তা চেক করা হচ্ছে
    const slugSet = new Set(AttributeValueSlugs);
    if (slugSet?.size !== AttributeValueSlugs?.length) {
      throw new ApiError(400, "Duplicate Attribute values Found!");
    }

    const result: IAttributeInterface | {} = await postAttributeServices(
      requestData
    );
    if (result) {
      // Phase E EM1 — return the created doc so admin product form can inject
      // the new attribute into selectedAttributes without a refetch round-trip.
      return sendResponse<IAttributeInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Attribute Added Successfully !",
        data: result as IAttributeInterface,
      });
    } else {
      throw new ApiError(400, "Attribute Added Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};

// Find All Attribute
export const findAllAttribute: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IAttributeInterface | any> => {
  try {
    const result: IAttributeInterface[] | any =
      await findAllAttributeServices();
    return sendResponse<IAttributeInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Attribute Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};
// Find All Dashboard Attribute
export const findAllDashboardAttribute: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IAttributeInterface | any> => {
  try {
    const { page, limit, searchTerm } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: IAttributeInterface[] | any =
      await findAllDashboardAttributeServices(limitNumber, skip, searchTerm);
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: attributeSearchableField.map((field) => ({
          [field]: {
            $regex: searchTerm,
            $options: "i",
          },
        })),
      });
    }
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await AttributeModel.countDocuments(whereCondition);
    return sendResponse<IAttributeInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Attribute Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All  Attribute using categoryID
export const findAllAttributeUsingCategoryID: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IAttributeInterface | any> => {
  try {
    const { category_id } = req.params;
    const result: IAttributeInterface[] | any =
      await findAllAttributeUsingCategoryIDServices(category_id);
    return sendResponse<IAttributeInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Attribute Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update A Attribute
export const updateAttribute: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IAttributeInterface | any> => {
  try {
    const requestData = stripDemoFlag(req.body);

    // Phase 0.5 V1 — empty / whitespace-only value rejection.
    // isCreate=false → partial PATCH OK (e.g. status toggle from list view
    // sends only { _id, attribute_status }).
    sanitizeAttributeValues(requestData, false);

    const findAttributeNameExit: boolean | null | undefined | any =
      requestData?.attribute_slug
        ? await AttributeModel.exists({
            $and: [
              { attribute_slug: requestData?.attribute_slug },
              // { category_id: requestData?.category_id },
            ],
          })
        : null;

    if (
      findAttributeNameExit &&
      requestData?._id !== findAttributeNameExit?._id.toString()
    ) {
      throw new ApiError(400, "Already Added !");
    }
    if (requestData?.attribute_values) {
      // `attribute_values` থেকে `attribute_value_slug` গুলো সংগ্রহ করা হচ্ছে
      const AttributeValueSlugs = requestData?.attribute_values?.map(
        (item: attributeValuesArray) => item?.attribute_value_slug
      );

      // যদি ডুপ্লিকেট স্লাগ থাকে তা চেক করা হচ্ছে
      const slugSet = new Set(AttributeValueSlugs);
      if (slugSet?.size !== AttributeValueSlugs?.length) {
        throw new ApiError(400, "Duplicate Attribute values Found!");
      }
    }

    const result: IAttributeInterface | any = await updateAttributeServices(
      requestData,
      requestData?._id
    );
    if (result?.modifiedCount > 0) {
      return sendResponse<IAttributeInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Attribute Update Successfully !",
      });
    } else {
      throw new ApiError(400, "Attribute Update Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};

// Phase A — count of products currently referencing this attribute. The
// admin UpdateAttribute form uses this for the "change will affect N
// products" warning (MOD #8). product_attributes[].attribute_id is the
// authoritative reference (variant_axes mirrors it for axis-flagged ones).
// B2 (2026-06-04) — delegates to shared `countProductsUsingAttribute` helper
// so this endpoint and the delete guard cannot drift on what counts as "in
// use". Response shape unchanged for back-compat (still `{ count }`).
export const getAttributeUsageCount: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { id } = req.params;
    if (!id) throw new ApiError(400, "attribute id required");
    const { count } = await countProductsUsingAttribute(id);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Attribute usage count",
      data: { count },
    });
  } catch (error: any) {
    next(error);
  }
};

// delete A Attribute item
// B2 (2026-06-04) — guard: refuse to delete an attribute that is referenced
// by any product. Returns 409 with the affected count + up to 10 sample
// product ids so the admin can deep-link to "view affected products" before
// retrying. Previous commented-out check was hard-blocking without count,
// the new path is informative.
export const deleteAAttributeInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const _id = req.body._id;
    if (!_id) throw new ApiError(400, "attribute id required");

    const usage = await countProductsUsingAttribute(_id);
    if (usage.count > 0) {
      return sendResponse(res, {
        statusCode: httpStatus.CONFLICT,
        success: false,
        message: `Cannot delete — used by ${usage.count} product${usage.count === 1 ? "" : "s"}. Remove from products first.`,
        data: usage,
      });
    }

    const result: IAttributeInterface | any = await deleteAttributeServices(
      _id
    );
    if (result?.deletedCount > 0) {
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Attribute Delete successfully !",
      });
    } else {
      throw new ApiError(400, "Attribute delete failed !");
    }
  } catch (error) {
    next(error);
  }
};
