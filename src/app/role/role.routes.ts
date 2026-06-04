import express from "express";
import {
  deleteARole,
  findAllDashboardRole,
  postRole,
  updateRole,
} from "./role.controllers";
import { verifyToken } from "../../middlewares/verify.token";
const router = express.Router();

// M1 fix: HTTP method → permission flag mapping was backward (role_show
// previously gated delete, etc.). Corrected so each verb checks the right flag.
router
  .route("/")
  .get(verifyToken("role_show"), findAllDashboardRole)
  .post(verifyToken("role_create"), postRole)
  .patch(verifyToken("role_update"), updateRole)
  .delete(verifyToken("role_delete"), deleteARole);

export const RoleRoutes = router;
