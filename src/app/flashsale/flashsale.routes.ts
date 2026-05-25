import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import {
  postFlashSale,
  findAllFlashSale,
  findAFlashSale,
  updateFlashSale,
  deleteFlashSale,
} from "./flashsale.controllers";

const router = express.Router();

router
  .route("/")
  .post(verifyToken("offer_create"), postFlashSale)
  .get(findAllFlashSale);

router
  .route("/:_id")
  .get(findAFlashSale)
  .patch(verifyToken("offer_update"), updateFlashSale)
  .delete(verifyToken("offer_delete"), deleteFlashSale);

export const FlashSaleRoutes = router;
