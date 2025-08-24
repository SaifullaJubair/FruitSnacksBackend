import express from "express";
import {
  deleteACategoryInfo,
  findAllCategory,
  findAllDashboardCategory,
  getCategorySubChildCategory,
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

// get banner category subCategory and childCategory
router.route("/category_sub_child").get(getCategorySubChildCategory);

// get six feature category
router.route("/feature_category").get(getSixFeaturedCategory);

// get all category in dashboard
router.route("/dashboard").get(verifyToken("category_show"), findAllDashboardCategory);

export const CategoryRoutes = router;
