import express from "express";
import {
  deleteACategoryInfo,
  findAllCategory,
  findAllDashboardCategory,
  getCategoryBreadcrumb,
  getCategoryChildren,
  getCategoryDefaults,
  getCategoryTree,
  getReparentImpact,
  getSixFeaturedCategory,
  postCategory,
  updateCategory,
} from "./category.controllers";
import { FileUploadHelper } from "../../helpers/image.upload";
import { verifyToken } from "../../middlewares/verify.token";
const router = express.Router();

// Create, Get category
router
  .route("/")
  .get(findAllCategory)
  .post(
    verifyToken("category_post"),
    FileUploadHelper.ImageUpload.fields([
      { name: "category_logo", maxCount: 1 },
      { name: "category_video", maxCount: 1 },
    ]),
    postCategory
  )
  .patch(
    verifyToken("category_update"),
    FileUploadHelper.ImageUpload.fields([
      { name: "category_logo", maxCount: 1 },
      { name: "category_video", maxCount: 1 },
    ]),
    updateCategory
  )
  .delete(verifyToken("category_delete"), deleteACategoryInfo);

// Full nested category tree (root nodes with nested children)
router.route("/tree").get(getCategoryTree);

// Featured categories for homepage (tree-aware: featured roots + their children)
router.route("/feature_category").get(getSixFeaturedCategory);

// All categories for the dashboard (flat, paginated)
router.route("/dashboard").get(verifyToken("category_show"), findAllDashboardCategory);

// Breadcrumb (ancestors → node) for one node — keep above /children to avoid clash
router.route("/breadcrumb/:id").get(getCategoryBreadcrumb);

// M24 — re-parent impact preview (descendant + product counts) for confirm dialog.
router.route("/reparent-impact/:id").get(verifyToken("category_update"), getReparentImpact);

// Direct children of one node (drill-down). :id = node id, or "root".
router.route("/children/:id").get(getCategoryChildren);

// Phase B — resolved default attributes (parent-merged, dead-ref filtered).
// Public — used by admin product form auto-apply + storefront filter fallback.
router.route("/defaults/:id").get(getCategoryDefaults);

export const CategoryRoutes = router;
