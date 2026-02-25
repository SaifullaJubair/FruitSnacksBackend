import express from "express";
import { fraudCheck } from "./fraud.controller";
import { verifyToken } from "../../middlewares/verify.token";

const router = express.Router();

router.route("/check").post(verifyToken("order_show"), fraudCheck);

export const FraudRoutes = router;
