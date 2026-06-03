import express from "express";
import {
  checkUserPhone,
  deleteAUser,
  findAllDashboardUser,
  postForgotPasswordUser,
  postLogUser,
  postUser,
  postUserResendCode,
  updateforgotPasswordUsersChangeNewPassword,
  updateUser,
  verifyUserOTP,
  refreshUser,
  logoutUserOwn,
} from "./user.controllers";
import { verifyToken } from "../../middlewares/verify.token";
// F002: per-IP rate limits on public auth/OTP surface.
import {
  authLimiter,
  otpSendLimiter,
  signupLimiter,
} from "../../middlewares/rate.limit";
const router = express.Router();

// Create, Get User
router
  .route("/")
  .get(verifyToken("user_show"), findAllDashboardUser)
  .post(signupLimiter, postUser)
  .patch(verifyToken("user_update"), updateUser)
  .delete(verifyToken("user_delete"), deleteAUser);

// Admin create user (admin-authed — no IP limiter needed)
router.route("/user_create").post(verifyToken("user_create"), postUser);

// user login
router.route("/login").post(authLimiter, postLogUser);

// Phase D: refresh access token (reads refresh cookie) + logout
router.route("/refresh").post(refreshUser);
router.route("/logout").post(logoutUserOwn);

// forgot password (triggers SMS — cost + spam control)
router.route("/forgetPassword").post(otpSendLimiter, postForgotPasswordUser);

// check user phone
router.route("/check_phone").get(checkUserPhone);

// verify User OTP (brute-force target)
router.route("/verifyOTP").post(authLimiter, verifyUserOTP);

// update User OTP and resend otp (triggers SMS)
router.route("/resend_otp").post(otpSendLimiter, postUserResendCode);

// set new password (brute-force target — guess OTP-validated session)
router
  .route("/setNewPassword")
  .post(authLimiter, updateforgotPasswordUsersChangeNewPassword);

export const UserRegRoutes = router;
