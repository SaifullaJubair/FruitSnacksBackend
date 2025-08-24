import express from "express";
import { FileUploadHelper } from "../../image.upload";
import { postVideoUpload } from "./video.upload.controllers";
const router = express.Router();

router
    .route("/")
    .post(
        FileUploadHelper.VideoUpload.fields([{ name: "video", maxCount: 1 }]),
        postVideoUpload
    );

export const VideoUploadRoutes = router;
