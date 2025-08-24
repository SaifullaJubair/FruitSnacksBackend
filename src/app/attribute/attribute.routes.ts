import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import {
  deleteAAttributeInfo,
  findAllAttribute,
  findAllAttributeUsingCategoryID,
  findAllDashboardAttribute,
  postAttribute,
  updateAttribute,
} from "./attribute.controllers";
const router = express.Router();

// Create, Get Attribute
router
  .route("/")
  .get(findAllAttribute)
  .post(verifyToken("attribute_post"), postAttribute)
  .patch(verifyToken("attribute_update"), updateAttribute)
  .delete(verifyToken("attribute_delete"), deleteAAttributeInfo);

// get all Attribute in dashboard
router.route("/dashboard").get(verifyToken("attribute_show"), findAllDashboardAttribute);

// get all Attribute using categoryID
router.route("/:category_id").get(findAllAttributeUsingCategoryID);

export const AttributeRoutes = router;
