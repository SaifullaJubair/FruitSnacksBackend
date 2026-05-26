import express from "express";
import { verifyUserToken } from "../../middlewares/verify.user.token";
import {
  addToWishlist,
  removeFromWishlist,
  findMyWishlist,
  syncWishlist,
} from "./wishlist.controllers";

const router = express.Router();

router.route("/").get(verifyUserToken, findMyWishlist);
router.route("/add").post(verifyUserToken, addToWishlist);
router.route("/remove").post(verifyUserToken, removeFromWishlist);
router.route("/sync").post(verifyUserToken, syncWishlist);

export const WishlistRoutes = router;
