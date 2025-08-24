import express from "express";
import { FileUploadHelper } from "../../helpers/image.upload";
import { verifyToken } from "../../middlewares/verify.token";
import {
  deleteABrandInfo,
  findAllBrand,
  findAllDashboardBrand,
  postBrand,
  updateBrand,
} from "./brand.controllers";
const router = express.Router();

// Create, Get Brand
router
  .route("/")
  .get(findAllBrand)
  .post(
    verifyToken("brand_post"),
    FileUploadHelper.ImageUpload.fields([{ name: "brand_logo", maxCount: 1 }]),
    postBrand
  )
  .patch(
    verifyToken("brand_update"),
    FileUploadHelper.ImageUpload.fields([{ name: "brand_logo", maxCount: 1 }]),
    updateBrand
  )
  .delete(verifyToken("brand_delete"), deleteABrandInfo);

// get all brand in dashboard
router.route("/dashboard").get(verifyToken("brand_show"), findAllDashboardBrand);

export const BrandRoutes = router;
