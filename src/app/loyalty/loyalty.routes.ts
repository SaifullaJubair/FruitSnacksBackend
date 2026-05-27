import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import { verifyUserToken } from "../../middlewares/verify.user.token";
import {
  adminAdjustLoyalty,
  findMyLoyaltyHistory,
  findAdminLoyaltyHistory,
} from "./loyalty.controllers";

const router = express.Router();

router.route("/adjust").post(verifyToken("user_update"), adminAdjustLoyalty);

// Admin viewer (A3b) — declared BEFORE `/history` so /history/admin doesn't
// fall through to the user-side handler.
router
  .route("/history/admin")
  .get(verifyToken("user_show"), findAdminLoyaltyHistory);

router.route("/history").get(verifyUserToken, findMyLoyaltyHistory);

export const LoyaltyRoutes = router;
