import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import { verifyUserToken } from "../../middlewares/verify.user.token";
import { adminAdjustWallet, findMyWalletHistory } from "./wallet.controllers";

const router = express.Router();

// Admin credit/debit a user's wallet (e.g. giftcard, refund, manual top-up).
router.route("/adjust").post(verifyToken("user_update"), adminAdjustWallet);

// User's own history (storefront).
router.route("/history").get(verifyUserToken, findMyWalletHistory);

export const WalletRoutes = router;
