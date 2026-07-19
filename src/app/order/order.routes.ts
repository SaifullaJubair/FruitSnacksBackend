import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
// F012 — user-scoped order history must be authenticated (no IDOR).
import { verifyUserToken } from "../../middlewares/verify.user.token";
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
  postAdminOrder,
  updateOrder,
  cancelSteadfastOrder,
  updateOrderDeliveryInfo,
  // S4+S5 Phase 1C — post-order opt-in email for guest checkout.
  setOrderEmail,
} from "./order.controller";

const router = express.Router();

// Customer order create & get
// F012 — GET is the logged-in customer's OWN order history; it must be
// authenticated and scoped to req.user.id (previously took customer_id from
// the query → any user could read anyone's orders).
router
  .route("/")
  .post(orderLimiter, postOrder)
  .get(verifyUserToken, getACustomerAllOrder)
  .patch(verifyToken("order_update"), updateOrder);

// Single order (guest checkout)
router.route("/single_order").post(orderLimiter, postSingleOrder);

// D18 — Admin POS order create (no rate limit — internal admin tool)
router.route("/create-admin").post(verifyToken("order_create_admin"), postAdminOrder);

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

// S4+S5 Phase 1C — opt-in email collection for guest orders, called
// from the post-order success-page prompt. Public (no auth) by
// design — the order_id in the URL is the bearer; security model is
// the same as the existing /:order_id GET. Single-use semantics:
// once customer_email is set we reject overwrites to prevent
// spoofing by anyone who guesses an order_id.
//
// ⚠️ MUST be before /:order_id route below to avoid CastError.
router.route("/:order_id/email").patch(setOrderEmail);

// Admin order detail (guarded). Same handler/data as the public /:order_id
// below, but behind `order_show` — this is what the admin panel's order-detail
// / print flows hit. The public /:order_id stays open because the storefront
// order-success + invoice pages call it while the just-placed guest has no
// session (order_id is the bearer). Closes the admin IDOR without touching that.
//
// ⚠️ MUST be before /:order_id route below to avoid CastError.
router
  .route("/admin/:order_id")
  .get(verifyToken("order_show"), getAOrderWithOrderProducts);

// Order details with products
// ⚠️ এই route সবার নিচে রাখতে হবে — নইলে /steadfast, /pathao, /dashboard
// সব /:order_id হিসেবে match হয়ে যাবে এবং Cast Error দেবে
router.route("/:order_id").get(getAOrderWithOrderProducts);

export const OrderRoutes = router;
