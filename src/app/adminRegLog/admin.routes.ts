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
const router = express.Router();

// Create, Get update and delete Admin side user
router
  .route("/")
  .get(getMeAdmin)
  .post(verifyToken("user_create"), postAdmin)
  .patch(verifyToken("user_update"), updateAdmin)
  .delete(verifyToken("user_delete"), deleteAAdmin);

// login a Admin
router.route("/login").post(postLogAdmin).patch(updateAdmin);

// Phase D: refresh access token (reads refresh cookie) + logout
router.route("/refresh").post(refreshAdmin);
router.route("/logout").post(logoutAdmin);

// Phase D: admin self password-reset (sends OTP to admin phone)
router.route("/forgot-password").post(forgotPasswordAdmin);
router.route("/reset-password").post(resetPasswordAdmin);

// get all dashboard admin
router.route("/dashboard").get(verifyToken("user_show"), findAllDashboardAdminRoleAdmin);

export const AdminRegRoutes = router;
