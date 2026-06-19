import express from "express";
import {
  deleteAReviewInfo,
  findAllDashboardReview,
  findAllReview,
  findAllSeededReview,
  findAllUnReviewProduct,
  findReviewsByIds,
  findFeaturedReviews,
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

// F4.1 — public featured reviews for home carousel auto_featured mode
// (active + 5-star + has photo). MUST stay before the :review_product_id
// wildcard or "featured" gets matched as a product id.
router.route("/featured").get(findFeaturedReviews);

// Sprint 3 — Seed Review routes (admin only)
// Bulk accepts an optional shared image as multipart (field "shared_image"),
// uploaded lazily on submit so abandoned uploads never orphan an S3 file.
// The JSON rows arrive in a "rows" form field (stringified).
router.route("/seed/bulk").post(
  verifyToken("review_seed_bulk"),
  FileUploadHelper.SeedImageUpload.fields([{ name: "shared_image", maxCount: 1 }]),
  seedReviewBulk,
);
router.route("/seed/manual").post(
  verifyToken("review_seed_manual"),
  FileUploadHelper.SeedImageUpload.fields([{ name: "review_image", maxCount: 1 }]),
  seedReviewManual,
);
router.route("/seed/list").get(verifyToken("review_show"), findAllSeededReview);

// get Review for a specific product (must be LAST — :review_product_id is a wildcard)
router.route("/:review_product_id").get(findAllReview);

export const ReviewRoutes = router;
