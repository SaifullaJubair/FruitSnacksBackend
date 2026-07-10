import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import {
  findVariationsByProduct,
  patchVariation,
  patchVariationsBulk,
} from "./variation.controllers";

const router = express.Router();

// Admin-only: the raw variation docs carry variation_buying_price (the shop's
// cost price), SKU, barcode and stock. This route used to be unauthenticated,
// so anyone who could guess a product _id could read the margins. Its only
// caller is the admin Page Content editor, which already sends credentials.
router.get(
  "/by-product/:productId",
  verifyToken("product_update"),
  findVariationsByProduct,
);

// MUST be declared before "/:id" — Express matches in declaration order, so
// otherwise PATCH /variation/bulk resolves to patchVariation with id="bulk"
// and dies in an ObjectId cast. Same hazard the /page-content route guards
// against in product.routes.ts.
router.patch("/bulk", verifyToken("product_update"), patchVariationsBulk);

router.patch("/:id", verifyToken("product_update"), patchVariation);

export const VariationRoutes = router;
