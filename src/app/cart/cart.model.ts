import { Schema, model } from "mongoose";
import { ICartInterface } from "./cart.interface";

const cartProductSchema = new Schema(
  {
    product_id: {
      type: Schema.Types.ObjectId,
      ref: "products",
      required: true,
    },
    variation_id: {
      type: Schema.Types.ObjectId,
      ref: "variations",
      default: null,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
  },
  { _id: false }
);

const cartSchema = new Schema<ICartInterface>(
  {
    cart_user_id: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
      unique: true, // প্রতি user এর একটাই cart
    },
    cart_products: [cartProductSchema],
  },
  {
    timestamps: true,
  }
);

const CartModel = model<ICartInterface>("carts", cartSchema);

export default CartModel;