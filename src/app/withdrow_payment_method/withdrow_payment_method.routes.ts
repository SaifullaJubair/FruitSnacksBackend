import express from "express";
import { FileUploadHelper } from "../../helpers/image.upload";
import { verifyToken } from "../../middlewares/verify.token";
import {
  deleteAPaymentMethodInfo,
  findAllDashboardPaymentMethod,
  findAllPaymentMethod,
  postPaymentMethod,
  updatePaymentMethod,
} from "./withdrow_payment_method.controllers";
const router = express.Router();

// Create, Get PaymentMethod
router
  .route("/")
  .get(findAllPaymentMethod)
  .post(
    FileUploadHelper.ImageUpload.fields([
      { name: "payment_method_image", maxCount: 1 },
    ]),
    postPaymentMethod
  )
  .patch(
    FileUploadHelper.ImageUpload.fields([
      { name: "payment_method_image", maxCount: 1 },
    ]),
    updatePaymentMethod
  )
  .delete(deleteAPaymentMethodInfo);

// get all PaymentMethod in Dashboard
router.route("/dashboard").get(findAllDashboardPaymentMethod);

export const PaymentMethodRoutes = router;
