import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import {
  sendToSteadfast,
  trackSteadfastOrder,
  getSteadfastBalance,
  sendToPathao,
  trackPathaoOrder,
} from "./courier.controller";

const router = express.Router();

// ===================== STEADFAST ROUTES =====================

// Steadfast এ order পাঠাও
router
  .route("/steadfast/send/:order_id")
  .post(verifyToken("order_update"), sendToSteadfast);

// Steadfast order track
router
  .route("/steadfast/track/:consignment_id")
  .get(verifyToken("order_show"), trackSteadfastOrder);

// Steadfast balance
router
  .route("/steadfast/balance")
  .get(verifyToken("order_show"), getSteadfastBalance);

// ===================== PATHAO ROUTES =====================

// Pathao তে order পাঠাও
router
  .route("/pathao/send/:order_id")
  .post(verifyToken("order_update"), sendToPathao);

// Pathao order track
router
  .route("/pathao/track/:consignment_id")
  .get(verifyToken("order_show"), trackPathaoOrder);

export const CourierRoutes = router;
