import express from "express";
import { FileUploadHelper } from "../../helpers/image.upload";
import {
  deleteABannerInfo,
  findAllBanner,
  findAllDashboardBanner,
  postBanner,
  updateBanner,
} from "./banner.controllers";
import { verifyToken } from "../../middlewares/verify.token";
const router = express.Router();

// Create, Get Banner
router
  .route("/")
  .get(findAllBanner)
  .post(
    verifyToken("banner_create"),
    FileUploadHelper.ImageUpload.fields([
      { name: "banner_image", maxCount: 1 },
    ]),
    postBanner
  )
  .patch(
    verifyToken("banner_update"),
    FileUploadHelper.ImageUpload.fields([
      { name: "banner_image", maxCount: 1 },
    ]),
    updateBanner
  )
  .delete(verifyToken("banner_delete"), deleteABannerInfo);

// get all Banner in dashboard
router.route("/dashboard").get(verifyToken("banner_show"), findAllDashboardBanner);

export const BannerRoutes = router;
