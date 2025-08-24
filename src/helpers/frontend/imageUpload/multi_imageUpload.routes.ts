import express from "express";
import { FileUploadHelper } from "../../image.upload";
import { postMultipleImageUploads } from "./multiImageUpload.controllers";
const router = express.Router();

router
  .route("/")
  .post(
    FileUploadHelper.ImageUpload.any(),
    postMultipleImageUploads
  );

export const MultiImageUploadRoutes = router;
