import express from "express";
import {
  deleteARole,
  findAllDashboardRole,
  postRole,
  updateRole,
} from "./role.controllers";
import { verifyToken } from "../../middlewares/verify.token";
const router = express.Router();

// Create, Get Role
router
  .route("/")
  .get(verifyToken("role_create"), findAllDashboardRole)
  .post(verifyToken("role_update"), postRole)
  .patch(verifyToken("role_delete"), updateRole)
  .delete(verifyToken("role_show"), deleteARole);

export const RoleRoutes = router;
