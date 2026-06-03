import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import {
  captureAbandonedCart,
  findAllAbandonedCart,
} from "./abandonedCart.controllers";

const router = express.Router();

// Public — storefront fires this when the buyer leaves checkout incomplete.
router.route("/capture").post(captureAbandonedCart);

// Admin only — list / dashboard for recovery campaigns.
router.route("/").get(verifyToken("order_show"), findAllAbandonedCart);

export const AbandonedCartRoutes = router;
