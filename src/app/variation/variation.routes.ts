import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import {
  findVariationsByProduct,
  patchVariation,
} from "./variation.controllers";

const router = express.Router();

router.get("/by-product/:productId", findVariationsByProduct);
router.patch("/:id", verifyToken("product_update"), patchVariation);

export const VariationRoutes = router;
