import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import {
  deleteAPaymentWithdrawListInfo,
  findAllDashboardPaymentWithdrawList,
  findAllSelfPaymentWithdrawList,
  postPaymentWithdrawList,
  updatePaymentWithdrawList,
} from "./paymentWithdrawList.controllers";
const router = express.Router();

// M3 fix: routes had NO auth — anyone (even logged-out) could create/update/
// delete withdraw requests. Now gated by admin token + payment_withdraw_*
// permission flags.
router
  .route("/")
  .get(verifyToken("payment_withdraw_show"), findAllSelfPaymentWithdrawList)
  .post(verifyToken("payment_withdraw_create"), postPaymentWithdrawList)
  .patch(verifyToken("payment_withdraw_update"), updatePaymentWithdrawList)
  .delete(verifyToken("payment_withdraw_delete"), deleteAPaymentWithdrawListInfo);

// get all PaymentWithdrawList in dashboard
router
  .route("/dashboard")
  .get(verifyToken("payment_withdraw_show"), findAllDashboardPaymentWithdrawList);

export const PaymentWithdrawListRoutes = router;
