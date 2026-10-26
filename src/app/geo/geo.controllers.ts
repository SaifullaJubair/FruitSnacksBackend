import { Request, RequestHandler, Response, NextFunction } from "express";
import httpStatus from "http-status";

import sendResponse from "../../shared/sendResponse";
import {
  findAllDistrictsServices,
  findAllGeoServices,
  findGeoBreadcrumbServices,
  findGeoChildrenServices,
  getGeoMappingStatsServices,
  updateGeoServices,
} from "./geo.services";
import { GeoType } from "./geo.interface";

/**
 * GET /geo/children?parent=<id>  — PUBLIC, and that is the point.
 *
 * The checkout's cascading dropdown. Omit `parent` for the divisions, then pass
 * the chosen id down the levels. Reads our own collection, so it needs no
 * courier credentials at all — which is what frees a Steadfast-only shop from
 * having to hold Pathao keys just to render a checkout, and what keeps
 * checkout working even if Pathao's API itself is down.
 */
export const getGeoChildren: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const parent = (req.query.parent as string) || null;
    const result = await findGeoChildrenServices(parent);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Locations fetched",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /geo/districts — PUBLIC. All 64 districts, flat, across every
 * division.
 *
 * The checkout's actual first dropdown (owner decision, 2026-10-27: Division
 * is skipped in the picker — one fewer screen to tap through). Division is
 * not lost from the data model, just from the UI; resolveGeoSnapshotServices
 * still fills it onto the order from whichever district/upazila the
 * customer picks.
 */
export const getAllDistricts: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const result = await findAllDistrictsServices();
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Districts fetched",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /geo/admin/children?parent=<id> — the same tree, INCLUDING switched-off
 * locations.
 *
 * 🔴 A separate route rather than a flag on the public one, and deliberately.
 * The obvious fix is `?includeInactive=true` on the public endpoint, but that
 * is a query parameter anyone can send: it would let the storefront checkout
 * offer districts the shop has explicitly stopped serving. A second route
 * carries the auth guard in the routing table, where it cannot be forgotten.
 */
export const getGeoChildrenAdmin: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const parent = (req.query.parent as string) || null;
    const result = await findGeoChildrenServices(parent, true);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Locations fetched",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

/** GET /geo/breadcrumb/:id — PUBLIC. Root → leaf, for display and snapshotting. */
export const getGeoBreadcrumb: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const result = await findGeoBreadcrumbServices(req.params.id);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Breadcrumb fetched",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

/** GET /geo/list — admin, paginated. */
export const listGeoAdmin: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    // Default 100: the admin browses this by level, and 64 districts or
    // several hundred upazilas in one screen is the normal case, not an edge
    // one.
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 100);
    const skip = (page - 1) * limit;
    const searchTerm = (req.query.searchTerm as string) || "";

    const filters: { type?: GeoType; parent_id?: string; is_active?: boolean } =
      {};
    const type = req.query.type as GeoType;
    if (type === "division" || type === "district" || type === "upazila") {
      filters.type = type;
    }
    if (req.query.parent_id) filters.parent_id = String(req.query.parent_id);
    if (req.query.is_active === "true") filters.is_active = true;
    if (req.query.is_active === "false") filters.is_active = false;

    const { data, total } = await findAllGeoServices(
      limit,
      skip,
      searchTerm,
      filters,
    );

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Locations fetched",
      data,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

/** PATCH /geo/:id — admin. Names, postal code, active flag, courier mappings. */
export const updateGeo: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const result = await updateGeoServices(req.params.id, req.body || {});
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Location updated",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /geo/mapping/:courier — admin. How much of this courier is mapped.
 *
 * Only Pathao is id-based in this clone: Steadfast takes a free-text address,
 * so "unmapped" is meaningless for it and the route refuses rather than
 * reporting a misleading 0%.
 */
export const getGeoMappingStats: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const courier = req.params.courier;
    if (courier !== "pathao") {
      return sendResponse(res, {
        statusCode: httpStatus.BAD_REQUEST,
        success: false,
        message:
          "Only Pathao addresses locations by id. Steadfast matches on a free-text address and needs no mapping.",
      });
    }
    const result = await getGeoMappingStatsServices(courier);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Mapping status fetched",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};
