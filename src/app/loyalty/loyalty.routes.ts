import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import { verifyUserToken } from "../../middlewares/verify.user.token";
import {
  adminAdjustLoyalty,
  findMyLoyaltyHistory,
} from "./loyalty.controllers";

const router = express.Router();

router.route("/adjust").post(verifyToken("user_update"), adminAdjustLoyalty);
router.route("/history").get(verifyUserToken, findMyLoyaltyHistory);

export const LoyaltyRoutes = router;
