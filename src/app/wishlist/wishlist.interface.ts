/**
 * wishlist.interface.ts — Phase G1.
 *
 * One row per (user, product) pair. Storefront has been localStorage-only; this
 * backend version keeps the wishlist across devices once the user logs in.
 * `notify_back_in_stock` lets us optionally email/SMS when the product goes
 * from 0 → in stock (hook deferred — flag is here for the future job).
 */

import { Types } from "mongoose";

export interface IWishlistInterface {
  _id?: any;
  user_id: Types.ObjectId;
  product_id: Types.ObjectId;
  variation_id?: Types.ObjectId;
  notify_back_in_stock?: boolean;
}
