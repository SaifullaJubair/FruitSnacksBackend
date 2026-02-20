import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import {
  getACustomerAllOrder,
  getAOrderWithOrderProducts,
  getDashboardOrder,
  getSteadfastOrders,
  getOrderTrackingInfo,
  postOrder,
  postSingleOrder,
  updateOrder,
  cancelSteadfastOrder,
} from "./order.controller";

const router = express.Router();

// Customer order create & get
router
  .route("/")
  .post(postOrder)
  .get(getACustomerAllOrder)
  .patch(verifyToken("order_update"), updateOrder);

// Single order (guest checkout)
router.route("/single_order").post(postSingleOrder);

// Dashboard orders (all + filter by order_status)
// GET /order/dashboard?order_status=pending&page=1&limit=10
router.route("/dashboard").get(verifyToken("order_show"), getDashboardOrder);

// Steadfast orders (tab wise filter by steadfast_status)
// GET /order/steadfast?steadfast_status=in_review&page=1&limit=10
// steadfast_status: all | pending | in_review | delivered | partial_delivered | cancelled
router.route("/steadfast").get(verifyToken("order_show"), getSteadfastOrders);
router
  .route("/steadfast/cancel/:order_id")
  .patch(verifyToken("order_update"), cancelSteadfastOrder);
// Order tracking (frontend)
router.route("/order_tracking").post(getOrderTrackingInfo);

// Order details with products
router.route("/:order_id").get(getAOrderWithOrderProducts);

export const OrderRoutes = router;