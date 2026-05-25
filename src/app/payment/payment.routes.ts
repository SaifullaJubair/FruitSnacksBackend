/**
 * payment.routes.ts — Phase C2 customer + admin payment endpoints.
 * Mounted at /api/v1/payment in src/routes/routes.ts.
 */

import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import {
  submitOrderPayment,
  verifyOrderPayment,
} from "./payment.controllers";

const router = express.Router();

// Customer submits the trxId after sending money (manual MFS / bank transfer).
// Public — caller proves ownership by having the order_id.
router.route("/submit/:order_id").patch(submitOrderPayment);

// Admin verifies the payment: { decision: "paid" | "failed", paid_amount?, note? }.
// "failed" cancels the order and triggers Phase-B restock.
router
  .route("/verify/:order_id")
  .patch(verifyToken("order_update"), verifyOrderPayment);

export const PaymentRoutes = router;
