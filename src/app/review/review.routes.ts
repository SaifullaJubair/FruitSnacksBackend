import express from "express";
import {
  deleteAReviewInfo,
  findAllDashboardReview,
  findAllReview,
  findAllSeededReview,
  findAllUnReviewProduct,
  findReviewsByIds,
  findUserReview,
  postReview,
  seedReviewBulk,
  seedReviewManual,
  updateReview,
} from "./review.controllers";
import { verifyToken } from "../../middlewares/verify.token";
import { FileUploadHelper } from "../../helpers/image.upload";
// F002: per-IP rate limit on public review submission (spam control).
import { reviewLimiter } from "../../middlewares/rate.limit";
const router = express.Router();

// Create, Get Review
router
  .route("/")
  .get(findUserReview)
  .post(
    reviewLimiter,
    FileUploadHelper.ImageUpload.fields([
      { name: "review_image", maxCount: 1 },
    ]),
    postReview
  )
  .patch(verifyToken("review_update"), updateReview)
  .delete(deleteAReviewInfo);

// get all UnReview Product
router.route("/unreview_product").get(findAllUnReviewProduct);

// get all Review in dashboard
router.route("/dashboard").get(verifyToken("review_show"), findAllDashboardReview);

// Track D — Reviews carousel manual-pick (public, before wildcard)
router.route("/by-ids").get(findReviewsByIds);

// Sprint 3 — Seed Review routes (admin only)
router.route("/seed/bulk").post(verifyToken("review_seed_bulk"), seedReviewBulk);
router.route("/seed/manual").post(
  verifyToken("review_seed_manual"),
  FileUploadHelper.ImageUpload.fields([{ name: "review_image", maxCount: 1 }]),
  seedReviewManual,
);
router.route("/seed/list").get(verifyToken("review_show"), findAllSeededReview);

// get Review for a specific product (must be LAST — :review_product_id is a wildcard)
router.route("/:review_product_id").get(findAllReview);

export const ReviewRoutes = router;
