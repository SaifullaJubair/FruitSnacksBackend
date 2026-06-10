import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import {
  postFlashSale,
  findAllFlashSale,
  findAFlashSale,
  updateFlashSale,
  deleteFlashSale,
  findActiveFlashSaleStorefront,
} from "./flashsale.controllers";

const router = express.Router();

router
  .route("/")
  .post(verifyToken("offer_create"), postFlashSale)
  .get(findAllFlashSale);

// Public storefront endpoint — must be BEFORE /:_id to avoid ID match
router.route("/active").get(findActiveFlashSaleStorefront);

router
  .route("/:_id")
  .get(findAFlashSale)
  .patch(verifyToken("offer_update"), updateFlashSale)
  .delete(verifyToken("offer_delete"), deleteFlashSale);

export const FlashSaleRoutes = router;
