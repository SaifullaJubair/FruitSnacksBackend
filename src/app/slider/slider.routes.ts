import express from "express";
import { FileUploadHelper } from "../../helpers/image.upload";
import { verifyToken } from "../../middlewares/verify.token";
import {
  deleteASliderInfo,
  findAllDashboardSlider,
  findAllSlider,
  postSlider,
  updateSlider,
} from "./slider.controllers";
const router = express.Router();

// Create, Get Slider
router
  .route("/")
  .get(findAllSlider)
  .post(
    verifyToken("slider_create"),
    FileUploadHelper.ImageUpload.fields([
      { name: "slider_image", maxCount: 1 },
    ]),
    postSlider
  )
  .patch(
    verifyToken("slider_update"),
    FileUploadHelper.ImageUpload.fields([
      { name: "slider_image", maxCount: 1 },
    ]),
    updateSlider
  )
  .delete(verifyToken("slider_delete"), deleteASliderInfo);

// get all Slider in dashboard
router.route("/dashboard").get(verifyToken("slider_show"), findAllDashboardSlider);

export const SliderRoutes = router;
