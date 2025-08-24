import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import {
  deleteASpecificationInfo,
  findAllDashboardSpecification,
  findAllSpecificationUsingCategoryID,
  postSpecification,
  updateSpecification,
} from "./specification.controllers";
const router = express.Router();

// Create, Get Specification
router
  .route("/")
  .post(verifyToken("specification_post"), postSpecification)
  .patch(verifyToken("specification_update"), updateSpecification)
  .delete(verifyToken("specification_delete"), deleteASpecificationInfo);

// get all Specification in dashboard
router.route("/dashboard").get(verifyToken("specification_show"), findAllDashboardSpecification);

// get all Specification using categoryID
router.route("/:category_id").get(findAllSpecificationUsingCategoryID);

export const SpecificationRoutes = router;
