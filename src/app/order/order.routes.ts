import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import {
  getACustomerAllOrder,
  getAOrderWithOrderProducts,
  getDashboardOrder,
  getOrderTrackingInfo,
  postOrder,
  postSingleOrder,
  updateOrder,
} from "./order.controller";
const router = express.Router();

// post order and get a cuustomer all order
router.route("/").post(postOrder).get(getACustomerAllOrder).patch( verifyToken("order_update"), updateOrder);

// post single order
router.route("/single_order").post(postSingleOrder);

// get all dashboard order
router.route("/dashboard").get( verifyToken("order_show"), getDashboardOrder);

// get order tracking info
router.route("/order_tracking").post(getOrderTrackingInfo);

// get a order with order details and order products
router.route("/:order_id").get(getAOrderWithOrderProducts);

export const OrderRoutes = router;
