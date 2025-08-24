import express from "express";
import { FileUploadHelper } from "../../image.upload";
import { postImageUpload } from "./imageUpload.controllers";
const router = express.Router();

router
  .route("/")
  .post(
    FileUploadHelper.ImageUpload.fields([{ name: "image", maxCount: 1 }]),
    postImageUpload
  );

  export const ImageUploadRoutes = router;
