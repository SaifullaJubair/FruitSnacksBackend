import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import {
  deleteAAuthenticationInfo,
  findAllAuthentication,
  findAllDashboardAuthentication,
  logoutUser,
  postAuthentication,
  updateAuthentication,
} from "./authentication.controllers";
const router = express.Router();

// Create, Get Authentication
router
  .route("/")
  // SECURITY (Phase 0): this GET returned the full auth config doc
  // (otp_phone_user / otp_phone_password = BulkSMS credentials) with NO guard
  // and NO field stripping — a plain credential leak. All 3 fields are secrets
  // (storefront never reads them), so gate the whole GET behind the secrets tier.
  .get(verifyToken("setting_secrets_update"), findAllAuthentication)
  .post(verifyToken("site_setting_update"), postAuthentication)
  .patch(verifyToken("site_setting_update"), updateAuthentication)
  // SECURITY (Phase 0): DELETE was unguarded → anyone could destroy the SMS
  // config document. Gate behind site_setting_update.
  .delete(verifyToken("site_setting_update"), deleteAAuthenticationInfo);

// get all Authentication in dashboard
// SECURITY (Phase 0): this GET was unguarded and returns the auth config doc
// containing sms_api_key / sms_password / sms_sender_id (BulkSMS credentials).
// Any browser could read it. Gate behind setting_secrets_update (secrets tier).
router
  .route("/dashboard")
  .get(verifyToken("setting_secrets_update"), findAllDashboardAuthentication);
router.post("/logout", logoutUser);

export const AuthenticationRoutes = router;
