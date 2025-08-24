import express from "express";
import {
  deleteACouponInfo,
  findACoupon,
  findAllDashboardCoupon,
  findAllSpecificUserCoupon,
  findProductToAddCoupon,
  postCoupon,
  updateCoupon,
} from "./coupon.controllers";
import { verifyToken } from "../../middlewares/verify.token";
const router = express.Router();

// Create, Get Coupon
router
  .route("/")
  .post(verifyToken("coupon_create"), postCoupon)
  .patch(verifyToken("coupon_update"), updateCoupon)
  .delete(verifyToken("coupon_delete"), deleteACouponInfo);

// get all Coupon in dashboard
router.route("/dashboard").get(verifyToken("coupon_show"), findAllDashboardCoupon);

// get all Coupon specific User
router.route("/specific_user").get(findAllSpecificUserCoupon);

// get all Coupon specific product
router.route("/specific_product").get(findProductToAddCoupon);

// check coupon for apply
router.route("/check_coupon").post(findACoupon);

export const CouponRoutes = router;
