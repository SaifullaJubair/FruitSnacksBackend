import express from "express";
import {
  deleteAAdmin,
  findAllDashboardAdminRoleAdmin,
  getMeAdmin,
  postAdmin,
  postLogAdmin,
  updateAdmin,
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

// get all dashboard admin
router.route("/dashboard").get(verifyToken("user_show"), findAllDashboardAdminRoleAdmin);

export const AdminRegRoutes = router;
