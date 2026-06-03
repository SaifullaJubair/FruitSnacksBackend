import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
// F002: per-IP rate limit on public order placement (burst spam control).
import { orderLimiter } from "../../middlewares/rate.limit";
import {
  getACustomerAllOrder,
  getAOrderWithOrderProducts,
  getDashboardOrder,
  getSteadfastOrders,
  getPathaoOrders,
  getOrderTrackingInfo,
  postOrder,
  postSingleOrder,
  updateOrder,
  cancelSteadfastOrder,
  updateOrderDeliveryInfo, // ✅ নতুন import
} from "./order.controller";

const router = express.Router();

// Customer order create & get
router
  .route("/")
  .post(orderLimiter, postOrder)
  .get(getACustomerAllOrder)
  .patch(verifyToken("order_update"), updateOrder);

// Single order (guest checkout)
router.route("/single_order").post(orderLimiter, postSingleOrder);

// Dashboard orders
router.route("/dashboard").get(verifyToken("order_show"), getDashboardOrder);

// Steadfast orders
router.route("/steadfast").get(verifyToken("order_show"), getSteadfastOrders);
router
  .route("/steadfast/cancel/:order_id")
  .patch(verifyToken("order_update"), cancelSteadfastOrder);

// ✅ Pathao orders
router.route("/pathao").get(verifyToken("order_show"), getPathaoOrders);

// Order tracking (frontend — no auth)
router.route("/order_tracking").post(getOrderTrackingInfo);

// ✅ Update delivery info (admin only)
// ⚠️ /:order_id এর আগে রাখতে হবে নইলে match হয়ে যাবে
router
  .route("/delivery-info/:order_id")
  .patch(verifyToken("order_update"), updateOrderDeliveryInfo);

// Order details with products
// ⚠️ এই route সবার নিচে রাখতে হবে — নইলে /steadfast, /pathao, /dashboard
// সব /:order_id হিসেবে match হয়ে যাবে এবং Cast Error দেবে
router.route("/:order_id").get(getAOrderWithOrderProducts);

export const OrderRoutes = router;
