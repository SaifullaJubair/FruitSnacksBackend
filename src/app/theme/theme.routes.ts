import express from "express";
import { FileUploadHelper } from "../../helpers/image.upload";
import { verifyToken } from "../../middlewares/verify.token";
import {
  approveTheme,
  deleteFloatingAsset,
  deleteTheme,
  findAllThemes,
  findThemeById,
  patchTheme,
  postFloatingAsset,
  postTheme,
} from "./theme.controllers";

const router = express.Router();

router
  .route("/")
  .get(findAllThemes)
  .post(
    verifyToken("theme_create"),
    FileUploadHelper.ImageUpload.fields([
      { name: "thumbnail_preview", maxCount: 1 },
    ]),
    postTheme,
  );

router
  .route("/:id")
  .get(findThemeById)
  .patch(
    verifyToken("theme_update"),
    FileUploadHelper.ImageUpload.fields([
      { name: "thumbnail_preview", maxCount: 1 },
    ]),
    patchTheme,
  )
  .delete(verifyToken("theme_delete"), deleteTheme);

router.post("/:id/approve", verifyToken("theme_update"), approveTheme);

router.post(
  "/:id/floating-asset",
  verifyToken("theme_update"),
  FileUploadHelper.ImageUpload.fields([{ name: "asset", maxCount: 1 }]),
  postFloatingAsset,
);

router.delete(
  "/:id/floating-asset/:index",
  verifyToken("theme_update"),
  deleteFloatingAsset,
);

export const ThemeRoutes = router;
