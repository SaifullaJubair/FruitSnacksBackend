import express from "express";
import {
  deleteAUser,
  findAllDashboardUser,
  postForgotPasswordUser,
  postLogUser,
  postUser,
  postUserResendCode,
  updateforgotPasswordUsersChangeNewPassword,
  updateUser,
} from "./user.controllers";
import { verifyToken } from "../../middlewares/verify.token";
const router = express.Router();

// Create, Get User
router
  .route("/")
  .get(verifyToken("user_show"), findAllDashboardUser)
  .post(postUser)
  .patch(verifyToken("user_update"), updateUser)
  .delete(verifyToken("user_delete"), deleteAUser);

// Admin create user
router.route("/user_create").post(verifyToken("user_create"), postUser);

// user login
router.route("/login").post(postLogUser);

// forgot password
router.route("/forgetPassword").post(postForgotPasswordUser);

// update User OTP and resend otp
router.route("/resend_otp").post(postUserResendCode);

// set new password
router
  .route("/setNewPassword")
  .post(updateforgotPasswordUsersChangeNewPassword);

export const UserRegRoutes = router;
