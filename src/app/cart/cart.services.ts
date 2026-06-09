import { Types } from "mongoose";
import CartModel from "./cart.model";
import ProductModel from "../product/product.model";
import { ICartProduct } from "./cart.interface";

// Get cart by user id — enriched with product_slug so FE setCartFromDB can carry it
export const getCartByUserIdService = async (user_id: string) => {
  const cart = await CartModel.findOne({ cart_user_id: user_id }).lean();
  if (!cart?.cart_products?.length) return cart;

  const productIds = cart.cart_products.map((p) => p.product_id);
  const products = await ProductModel.find({ _id: { $in: productIds } })
    .select("product_slug")
    .lean();
  const slugMap = new Map(products.map((p: any) => [String(p._id), p.product_slug]));

  const enriched = cart.cart_products.map((item) => ({
    ...item,
    product_slug: slugMap.get(String(item.product_id)) || null,
  }));

  return { ...cart, cart_products: enriched };
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
    // DB তে cart নেই → local cart দিয়ে create করো
    cart = await CartModel.create({
      cart_user_id: user_id,
      cart_products: localProducts,
    });
    return cart;
  }

  // DB cart আছে → merge করো
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
      // Same product DB তে আছে → MAX quantity নাও (Shopify/Daraz standard)
      cart.cart_products[existingIndex].quantity = Math.max(
        cart.cart_products[existingIndex].quantity,
        localItem.quantity,
      );
    } else {
      // নতুন product → add করো
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
