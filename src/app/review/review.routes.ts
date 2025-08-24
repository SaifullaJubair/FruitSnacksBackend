import express from "express";
import {
  deleteAReviewInfo,
  findAllDashboardReview,
  findAllReview,
  findAllUnReviewProduct,
  findUserReview,
  postReview,
  updateReview,
} from "./review.controllers";
import { verifyToken } from "../../middlewares/verify.token";
import { FileUploadHelper } from "../../helpers/image.upload";
const router = express.Router();

// Create, Get Review
router
  .route("/")
  .get(findUserReview)
  .post(
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

// get Review for a specific product
router.route("/:review_product_id").get(findAllReview);

export const ReviewRoutes = router;
