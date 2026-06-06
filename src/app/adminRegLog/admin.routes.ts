import express from "express";
import {
  deleteAAdmin,
  findAllDashboardAdminRoleAdmin,
  getMeAdmin,
  postAdmin,
  postLogAdmin,
  updateAdmin,
  refreshAdmin,
  logoutAdmin,
  forgotPasswordAdmin,
  resetPasswordAdmin,
} from "./admin.controllers";
import { verifyToken } from "../../middlewares/verify.token";
// F002: per-IP rate limits on public auth surface.
import {
  authLimiter,
  otpSendHourlyLimiter,
  otpSendDailyLimiter,
} from "../../middlewares/rate.limit";
const router = express.Router();

// Create, Get update and delete Admin side user
router
  .route("/")
  .get(getMeAdmin)
  .post(verifyToken("user_create"), postAdmin)
  .patch(verifyToken("user_update"), updateAdmin)
  .delete(verifyToken("user_delete"), deleteAAdmin);

// login a Admin (brute-force target)
router.route("/login").post(authLimiter, postLogAdmin).patch(updateAdmin);

// Phase D: refresh access token (reads refresh cookie) + logout
router.route("/refresh").post(refreshAdmin);
router.route("/logout").post(logoutAdmin);

// Phase D: admin self password-reset (sends OTP — dual cap: 5/hour AND 30/day)
router
  .route("/forgot-password")
  .post(otpSendHourlyLimiter, otpSendDailyLimiter, forgotPasswordAdmin);
router.route("/reset-password").post(authLimiter, resetPasswordAdmin);

// get all dashboard admin
router.route("/dashboard").get(verifyToken("user_show"), findAllDashboardAdminRoleAdmin);

export const AdminRegRoutes = router;
