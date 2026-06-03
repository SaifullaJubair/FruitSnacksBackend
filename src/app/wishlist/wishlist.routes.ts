import express from "express";
import { verifyUserToken } from "../../middlewares/verify.user.token";
import { verifyToken } from "../../middlewares/verify.token";
import {
  addToWishlist,
  removeFromWishlist,
  findMyWishlist,
  syncWishlist,
  findAdminWishlist,
} from "./wishlist.controllers";

const router = express.Router();

// Admin viewer (A3b) — declared BEFORE `/` so /admin doesn't fall through to it.
router.route("/admin").get(verifyToken("user_show"), findAdminWishlist);

router.route("/").get(verifyUserToken, findMyWishlist);
router.route("/add").post(verifyUserToken, addToWishlist);
router.route("/remove").post(verifyUserToken, removeFromWishlist);
router.route("/sync").post(verifyUserToken, syncWishlist);

export const WishlistRoutes = router;
