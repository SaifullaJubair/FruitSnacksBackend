import { Schema, model } from "mongoose";
import { IWishlistInterface } from "./wishlist.interface";

const wishlistSchema = new Schema<IWishlistInterface>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },
    product_id: {
      type: Schema.Types.ObjectId,
      ref: "products",
      required: true,
      index: true,
    },
    variation_id: { type: Schema.Types.ObjectId, ref: "variations" },
    notify_back_in_stock: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// One row per (user, product, variation?) — unique.
wishlistSchema.index(
  { user_id: 1, product_id: 1, variation_id: 1 },
  { unique: true },
);

const WishlistModel = model<IWishlistInterface>("wishlists", wishlistSchema);
export default WishlistModel;
