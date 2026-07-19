import express from "express";
import { FileUploadHelper } from "../../image.upload";
import { postImageUpload } from "./imageUpload.controllers";
import { verifyAnyAuth } from "../../../middlewares/verify.any.auth";
const router = express.Router();

// verifyAnyAuth runs BEFORE multer — an anonymous request is rejected without
// ever writing a file to the bucket. Any logged-in admin OR storefront user
// may upload (admin panel images + a user's profile avatar); anonymous cannot.
router
  .route("/")
  .post(
    verifyAnyAuth,
    FileUploadHelper.ImageUpload.fields([{ name: "image", maxCount: 1 }]),
    postImageUpload
  );

  export const ImageUploadRoutes = router;
