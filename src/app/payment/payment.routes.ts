/**
 * payment.routes.ts — Phase C2 customer + admin payment endpoints.
 * Mounted at /api/v1/payment in src/routes/routes.ts.
 */

import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import {
  submitOrderPayment,
  submitOrderPaymentWithScreenshot,
  verifyOrderPayment,
} from "./payment.controllers";
import {
  sslcommerzSuccess,
  sslcommerzFail,
  sslcommerzCancel,
  sslcommerzIpn,
} from "./sslcommerz.controllers";
import { FileUploadHelper } from "../../helpers/image.upload";

const router = express.Router();

// Customer submits the trxId after sending money (manual MFS / bank transfer).
// Public — caller proves ownership by having the order_id.
router.route("/submit/:order_id").patch(submitOrderPayment);

// Phase C4: same as above but accepts a deposit-slip screenshot upload
// (multipart/form-data). First file in the upload is stored as the screenshot.
router
  .route("/submit-with-screenshot/:order_id")
  .patch(
    FileUploadHelper.ImageUpload.any(),
    submitOrderPaymentWithScreenshot,
  );

// Admin verifies the payment: { decision: "paid" | "failed", paid_amount?, note? }.
// "failed" cancels the order and triggers Phase-B restock.
router
  .route("/verify/:order_id")
  .patch(verifyToken("order_update"), verifyOrderPayment);

// ── Phase C1: SSLCommerz callbacks (PUBLIC — SSL hits these from outside) ───
// All POST form-urlencoded. We don't trust the body; the success/ipn
// handlers re-validate via SSLCommerz validator API before flipping to paid.
router.route("/sslcommerz/success").post(sslcommerzSuccess);
router.route("/sslcommerz/fail").post(sslcommerzFail);
router.route("/sslcommerz/cancel").post(sslcommerzCancel);
router.route("/sslcommerz/ipn").post(sslcommerzIpn);

export const PaymentRoutes = router;
