import express from "express";
import { verifyToken } from "../../../middlewares/verify.token";
import {
  sendToSteadfast,
  trackSteadfastOrder,
  getSteadfastBalance,
  sendToPathao,
  bulkSendToSteadfast,
  syncSteadfastOrder,
  trackPathaoOrder,
  syncPathaoOrder,
  bulkSendToPathao,
  bulkSyncPathaoOrders,
  cancelPathaoOrder,
} from "./courier.controller";

const router = express.Router();

// ===================== STEADFAST ROUTES =====================

router
  .route("/steadfast/send/:order_id")
  .post(verifyToken("order_update"), sendToSteadfast);

router
  .route("/steadfast/bulk-send")
  .post(verifyToken("order_update"), bulkSendToSteadfast);

router
  .route("/steadfast/sync/:order_id")
  .patch(verifyToken("order_update"), syncSteadfastOrder);

router
  .route("/steadfast/track/:consignment_id")
  .get(verifyToken("order_show"), trackSteadfastOrder);

router
  .route("/steadfast/balance")
  .get(verifyToken("order_show"), getSteadfastBalance);

// ===================== PATHAO ROUTES =====================

router
  .route("/pathao/send/:order_id")
  .post(verifyToken("order_update"), sendToPathao);

router
  .route("/pathao/bulk-send")
  .post(verifyToken("order_update"), bulkSendToPathao);

router
  .route("/pathao/sync/:order_id")
  .patch(verifyToken("order_update"), syncPathaoOrder);

router
  .route("/pathao/bulk-sync")
  .post(verifyToken("order_update"), bulkSyncPathaoOrders);

router
  .route("/pathao/cancel/:order_id")
  .patch(verifyToken("order_update"), cancelPathaoOrder);

router
  .route("/pathao/track/:consignment_id")
  .get(verifyToken("order_show"), trackPathaoOrder);

export const CourierRoutes = router;
