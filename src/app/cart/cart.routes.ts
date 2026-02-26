import express from "express";
import { getCart, syncCart, updateCart, clearCart } from "./cart.controller";
import { verifyUserToken } from "../../middlewares/verify.user.token";

const router = express.Router();

// GET  /cart       — user এর cart আনো
// POST /cart/sync  — login এর পরে localStorage sync
// PUT  /cart       — cart update (add/remove/quantity)
// DELETE /cart     — cart clear

router
  .route("/")
  .get(verifyUserToken, getCart)
  .put(verifyUserToken, updateCart)
  .delete(verifyUserToken, clearCart);

router.route("/sync").post(verifyUserToken, syncCart);

export const CartRoutes = router;
