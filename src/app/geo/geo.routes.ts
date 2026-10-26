import express from "express";

import { verifyToken } from "../../middlewares/verify.token";
import {
  getAllDistricts,
  getGeoBreadcrumb,
  getGeoChildren,
  getGeoChildrenAdmin,
  getGeoMappingStats,
  listGeoAdmin,
  updateGeo,
} from "./geo.controllers";

const router = express.Router();

/**
 * ── PUBLIC ────────────────────────────────────────────────────────────────
 *
 * Unauthenticated on purpose: this is the checkout's address picker, and the
 * customer choosing a district is not logged in. It exposes only the published
 * administrative geography of Bangladesh — names and the tree — which is public
 * record. Courier ids are NOT in the projection (see PUBLIC_FIELDS in
 * geo.services.ts).
 *
 * This is the route Phase 2 wires the storefront checkout to, replacing the
 * live Pathao `/setting/zone` call the checkout used to depend on.
 */
router.route("/children").get(getGeoChildren);
router.route("/districts").get(getAllDistricts);
router.route("/breadcrumb/:id").get(getGeoBreadcrumb);

/**
 * ── ADMIN ─────────────────────────────────────────────────────────────────
 *
 * Rides `site_setting_update`, deliberately adding NO new permission flag: a
 * new flag is unreachable on an existing admin until the backfill runs — there
 * is no super-admin bypass here — so it would lock the owner out of a page that
 * looks installed. Delivery geography is shop configuration, which is exactly
 * what that flag already governs.
 */
router
  .route("/admin/children")
  .get(verifyToken("site_setting_update"), getGeoChildrenAdmin);
router.route("/list").get(verifyToken("site_setting_update"), listGeoAdmin);
router
  .route("/mapping/:courier")
  .get(verifyToken("site_setting_update"), getGeoMappingStats);

// `/:id` LAST — otherwise it swallows /children, /list and /mapping and throws
// a CastError on each. Same trap documented in order.routes.ts.
router.route("/:id").patch(verifyToken("site_setting_update"), updateGeo);

export const GeoRoutes = router;
