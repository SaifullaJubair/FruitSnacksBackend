import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import {
  deleteAAuthenticationInfo,
  findAllAuthentication,
  findAllDashboardAuthentication,
  postAuthentication,
  updateAuthentication,
} from "./authentication.controllers";
const router = express.Router();

// Create, Get Authentication
router
  .route("/")
  .get(findAllAuthentication)
  .post(verifyToken("site_setting_update"), postAuthentication)
  .patch(verifyToken("site_setting_update"), updateAuthentication)
  .delete(deleteAAuthenticationInfo);

// get all Authentication in dashboard
router.route("/dashboard").get(findAllDashboardAuthentication);

export const AuthenticationRoutes = router;
