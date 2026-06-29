import express from "express";
import { verifyToken } from "../../../middlewares/verify.token";
import { FileUploadHelper } from "../../../helpers/image.upload";
import {
  v2BrandList,
  v2BrandCreate,
  v2BrandUpdate,
  v2BrandDelete,
  v2BrandReorder,
} from "./v2.brand.controllers";

const router = express.Router();

const logo = FileUploadHelper.ImageUpload.fields([
  { name: "brand_logo", maxCount: 1 },
]);

// Static paths BEFORE /:id so "list"/"reorder" aren't captured as an id (edge N3).
router.get("/list", verifyToken("brand_show"), v2BrandList);
router.patch("/reorder", verifyToken("brand_update"), v2BrandReorder);

router.post("/", verifyToken("brand_post"), logo, v2BrandCreate);
router.patch("/:id", verifyToken("brand_update"), logo, v2BrandUpdate);
router.delete("/:id", verifyToken("brand_delete"), v2BrandDelete);

export const V2BrandRoutes = router;
