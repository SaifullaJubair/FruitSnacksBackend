import { Types } from "mongoose";
import CartModel from "./cart.model";
import { ICartProduct } from "./cart.interface";

// Get cart by user id
export const getCartByUserIdService = async (user_id: string) => {
  const cart = await CartModel.findOne({ cart_user_id: user_id }).lean();
  return cart;
};

// Sync localStorage cart to DB on login
// Logic: localStorage items merge হবে DB cart এর সাথে
// Same product+variation থাকলে quantity add হবে
export const syncCartService = async (
  user_id: string,
  localProducts: ICartProduct[],
) => {
  let cart = await CartModel.findOne({ cart_user_id: user_id });

  if (!cart) {
    // নতুন cart create করো
    cart = await CartModel.create({
      cart_user_id: user_id,
      cart_products: localProducts,
    });
    return cart;
  }

  // Existing cart এ merge করো
  for (const localItem of localProducts) {
    const existingIndex = cart.cart_products.findIndex((item) => {
      const productMatch =
        item.product_id.toString() === localItem.product_id.toString();
      const variationMatch = localItem.variation_id
        ? item.variation_id?.toString() === localItem.variation_id.toString()
        : !item.variation_id;
      return productMatch && variationMatch;
    });

    if (existingIndex > -1) {
      // Already আছে — quantity add করো
      cart.cart_products[existingIndex].quantity += localItem.quantity;
    } else {
      // নেই — নতুন add করো
      cart.cart_products.push(localItem);
    }
  }

  await cart.save();
  return cart;
};

// Update entire cart (add/remove/update quantity)
export const updateCartService = async (
  user_id: string,
  cart_products: ICartProduct[],
) => {
  const cart = await CartModel.findOneAndUpdate(
    { cart_user_id: user_id },
    { cart_products },
    { new: true, upsert: true, runValidators: true },
  );
  return cart;
};

// Clear cart (order complete হলে)
export const clearCartService = async (user_id: string) => {
  const cart = await CartModel.findOneAndUpdate(
    { cart_user_id: user_id },
    { cart_products: [] },
    { new: true },
  );
  return cart;
};
