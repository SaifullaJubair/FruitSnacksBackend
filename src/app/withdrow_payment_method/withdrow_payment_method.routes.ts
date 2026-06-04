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

// M3 fix: routes had NO auth — anyone could create/update/delete payment
// methods (including uploading arbitrary images via the multer hook). Now
// gated by admin token + payment_method_* permission flags. GET stays public
// so the storefront can list active payment options at checkout.
router
  .route("/")
  .get(findAllPaymentMethod)
  .post(
    verifyToken("payment_method_create"),
    FileUploadHelper.ImageUpload.fields([
      { name: "payment_method_image", maxCount: 1 },
    ]),
    postPaymentMethod
  )
  .patch(
    verifyToken("payment_method_update"),
    FileUploadHelper.ImageUpload.fields([
      { name: "payment_method_image", maxCount: 1 },
    ]),
    updatePaymentMethod
  )
  .delete(verifyToken("payment_method_delete"), deleteAPaymentMethodInfo);

// get all PaymentMethod in Dashboard (admin-only listing)
router
  .route("/dashboard")
  .get(verifyToken("payment_method_show"), findAllDashboardPaymentMethod);

export const PaymentMethodRoutes = router;
