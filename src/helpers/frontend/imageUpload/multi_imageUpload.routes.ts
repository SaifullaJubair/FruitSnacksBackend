import express from "express";
import { FileUploadHelper } from "../../image.upload";
import { postMultipleImageUploads } from "./multiImageUpload.controllers";
import { verifyAnyAuth } from "../../../middlewares/verify.any.auth";
const router = express.Router();

// verifyAnyAuth runs BEFORE multer — an anonymous request is rejected without
// ever writing files to the bucket. See imageUpload.routes.ts for the rationale.
router
  .route("/")
  .post(
    verifyAnyAuth,
    FileUploadHelper.ImageUpload.any(),
    postMultipleImageUploads
  );

export const MultiImageUploadRoutes = router;
