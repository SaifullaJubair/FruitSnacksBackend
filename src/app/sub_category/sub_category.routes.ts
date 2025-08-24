import express from "express";
import { FileUploadHelper } from "../../helpers/image.upload";
import { verifyToken } from "../../middlewares/verify.token";
import {
  deleteASubCategoryInfo,
  findAllDashboardSubCategory,
  findAllSubCategory,
  postSubCategory,
  updateSubCategory,
} from "./sub_category.controllers";
const router = express.Router();

// Create, Get Subcategory
router
  .route("/")
  .get(findAllSubCategory)
  .post(
    verifyToken("sub_category_post"),
    FileUploadHelper.ImageUpload.fields([
      { name: "sub_category_logo", maxCount: 1 },
    ]),
    postSubCategory
  )
  .patch(
    verifyToken("sub_category_update"),
    FileUploadHelper.ImageUpload.fields([
      { name: "sub_category_logo", maxCount: 1 },
    ]),
    updateSubCategory
  )
  .delete(verifyToken("sub_category_delete"), deleteASubCategoryInfo);

// get all category in dashboard
router.route("/dashboard").get(verifyToken("sub_category_show"), findAllDashboardSubCategory);

export const Sub_CategoryRoutes = router;
