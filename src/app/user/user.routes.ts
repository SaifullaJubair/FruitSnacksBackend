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
  // S6 (2026-06-04) — address CRUD for the logged-in storefront user.
  listMyAddresses,
  addMyAddress,
  updateMyAddress,
  deleteMyAddress,
  setMyDefaultAddress,
  // S4+S5 Phase 1C — optional email opt-in for logged-in users.
  setMyEmail,
} from "./user.controllers";
import { verifyToken } from "../../middlewares/verify.token";
import { verifyUserToken } from "../../middlewares/verify.user.token";
// F002: per-IP rate limits on public auth/OTP surface.
import {
  authLimiter,
  otpSendHourlyLimiter,
  otpSendDailyLimiter,
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

// forgot password (triggers SMS — dual cap: 5/hour AND 30/day)
router
  .route("/forgetPassword")
  .post(otpSendHourlyLimiter, otpSendDailyLimiter, postForgotPasswordUser);

// check user phone
router.route("/check_phone").get(checkUserPhone);

// verify User OTP (brute-force target)
router.route("/verifyOTP").post(authLimiter, verifyUserOTP);

// update User OTP and resend otp (triggers SMS — dual cap: 5/hour AND 30/day)
router
  .route("/resend_otp")
  .post(otpSendHourlyLimiter, otpSendDailyLimiter, postUserResendCode);

// set new password (brute-force target — guess OTP-validated session)
router
  .route("/setNewPassword")
  .post(authLimiter, updateforgotPasswordUsersChangeNewPassword);

// S6 (2026-06-04) — saved-address CRUD. All require an active storefront
// session via verifyUserToken; nothing here affects the anonymous FB-ads
// checkout flow which keeps using inline billing fields on the order body.
// `/addresses` (plural) collection; `/address/:address_id` single ops.
router.route("/addresses").get(verifyUserToken, listMyAddresses);
router.route("/address").post(verifyUserToken, addMyAddress);
router
  .route("/address/:address_id")
  .patch(verifyUserToken, updateMyAddress)
  .delete(verifyUserToken, deleteMyAddress);
router
  .route("/address/:address_id/default")
  .patch(verifyUserToken, setMyDefaultAddress);

// S4+S5 Phase 1C — opt-in email for logged-in users. Used by the
// Profile Setting page and the post-order prompt when the buyer is
// already signed in. Guests use PATCH /order/:order_id/email instead
// (in order.routes.ts) so anon FB-ads flow doesn't need auth.
router.route("/me/email").patch(verifyUserToken, setMyEmail);

export const UserRegRoutes = router;
