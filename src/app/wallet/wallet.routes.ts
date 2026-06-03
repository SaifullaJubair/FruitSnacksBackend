import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import { verifyUserToken } from "../../middlewares/verify.user.token";
import {
  adminAdjustWallet,
  findMyWalletHistory,
  findAdminWalletHistory,
} from "./wallet.controllers";

const router = express.Router();

// Admin credit/debit a user's wallet (e.g. giftcard, refund, manual top-up).
router.route("/adjust").post(verifyToken("user_update"), adminAdjustWallet);

// Admin viewer (V): inspect any user's wallet ledger. Declared BEFORE /history
// so /history/admin doesn't fall through to the user-side handler.
router
  .route("/history/admin")
  .get(verifyToken("user_show"), findAdminWalletHistory);

// User's own history (storefront).
router.route("/history").get(verifyUserToken, findMyWalletHistory);

export const WalletRoutes = router;
