import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import {
  getSetting,
  getSettingSecrets,
  getZoneData,
  postSetting,
  updateSettingSecrets,
} from "./setting.controllers";
const router = express.Router();

// Create, update and get  setting (public GET, secrets stripped)
router
  .route("/")
  .get(getSetting)
  .patch(verifyToken("site_setting_update"), postSetting);

// S4+S5 Phase 1A — admin-only secret endpoints.
// New permission flag `setting_secrets_update` separates CAPI/SMS/courier
// credentials from general site-setting edit rights, so staff with
// `site_setting_update` cannot rotate the owner's Meta access token.
router
  .route("/secrets")
  .get(verifyToken("setting_secrets_update"), getSettingSecrets)
  .patch(verifyToken("setting_secrets_update"), updateSettingSecrets);

// get city wise zone data
router.route("/zone").get(getZoneData);

export const SettingRoutes = router;
