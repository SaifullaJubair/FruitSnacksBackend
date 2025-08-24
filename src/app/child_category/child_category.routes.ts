import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import {
  deleteAChildCategoryInfo,
  findAllChildCategory,
  findAllDashboardChildCategory,
  postChildCategory,
  updateChildCategory,
} from "./child_category.controllers";
const router = express.Router();

// Create, Get Childcategory
router
  .route("/")
  .get(findAllChildCategory)
  .post(verifyToken("child_category_post"), postChildCategory)
  .patch(verifyToken("child_category_update"), updateChildCategory)
  .delete(verifyToken("child_category_delete"), deleteAChildCategoryInfo);

// get all category in dashboard
router.route("/dashboard").get(verifyToken("child_category_show"), findAllDashboardChildCategory);

export const Child_CategoryRoutes = router;
