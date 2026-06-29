import express from "express";
import { verifyToken } from "../../../middlewares/verify.token";
import { FileUploadHelper } from "../../../helpers/image.upload";
import {
  v2CategoryList,
  v2CategoryTree,
  v2CategoryReparentImpact,
  v2CategoryCreate,
  v2CategoryUpdate,
  v2CategoryDelete,
  v2CategoryReorder,
} from "./v2.category.controllers";

const router = express.Router();

const media = FileUploadHelper.ImageUpload.fields([
  { name: "category_logo", maxCount: 1 },
  { name: "category_video", maxCount: 1 },
]);

// Static paths BEFORE /:id so they aren't captured as an id (edge N3).
router.get("/list", verifyToken("category_show"), v2CategoryList);
router.get("/tree", verifyToken("category_show"), v2CategoryTree);
router.patch("/reorder", verifyToken("category_update"), v2CategoryReorder);
router.get(
  "/reparent-impact/:id",
  verifyToken("category_update"),
  v2CategoryReparentImpact,
);

router.post("/", verifyToken("category_post"), media, v2CategoryCreate);
router.patch("/:id", verifyToken("category_update"), media, v2CategoryUpdate);
router.delete("/:id", verifyToken("category_delete"), v2CategoryDelete);

export const V2CategoryRoutes = router;
