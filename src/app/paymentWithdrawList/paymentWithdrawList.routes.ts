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

// Create, Get PaymentWithdrawList
router
  .route("/")
  .get(findAllSelfPaymentWithdrawList)
  .post(postPaymentWithdrawList)
  .patch(updatePaymentWithdrawList)
  .delete(deleteAPaymentWithdrawListInfo);

// get all PaymentWithdrawList in dashboard
router
  .route("/dashboard")
  .get(findAllDashboardPaymentWithdrawList);

export const PaymentWithdrawListRoutes = router;
