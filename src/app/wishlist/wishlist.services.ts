import WishlistModel from "./wishlist.model";

export const addToWishlistServices = async (
  user_id: any,
  product_id: any,
  variation_id?: any,
  notify_back_in_stock?: boolean,
): Promise<any> => {
  // Upsert so a repeat-add doesn't throw duplicate-key.
  return WishlistModel.findOneAndUpdate(
    { user_id, product_id, variation_id: variation_id || null },
    { $set: { notify_back_in_stock: !!notify_back_in_stock } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

export const removeFromWishlistServices = async (
  user_id: any,
  product_id: any,
  variation_id?: any,
): Promise<any> =>
  WishlistModel.deleteOne({
    user_id,
    product_id,
    variation_id: variation_id || null,
  });

export const findMyWishlistServices = async (
  user_id: any,
  limit = 100,
  skip = 0,
): Promise<any> => {
  const [rows, total] = await Promise.all([
    WishlistModel.find({ user_id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "product_id",
        model: "products",
        select:
          "product_name product_slug product_price product_discount_price product_quantity main_image",
      })
      .populate({
        path: "variation_id",
        model: "variations",
        select: "variation_name variation_price variation_quantity",
      }),
    WishlistModel.countDocuments({ user_id }),
  ]);
  return { rows, total };
};

/**
 * Sync the whole wishlist after a logged-in session loads (or after login).
 * `items` = array of { product_id, variation_id?, notify_back_in_stock? }.
 * Upserts each — does NOT delete missing items (storefront-local lists may
 * legitimately be a subset).
 */
export const syncWishlistServices = async (
  user_id: any,
  items: Array<{
    product_id: any;
    variation_id?: any;
    notify_back_in_stock?: boolean;
  }>,
): Promise<{ synced: number }> => {
  if (!Array.isArray(items) || items.length === 0) return { synced: 0 };
  for (const it of items) {
    await WishlistModel.findOneAndUpdate(
      { user_id, product_id: it.product_id, variation_id: it.variation_id || null },
      { $set: { notify_back_in_stock: !!it.notify_back_in_stock } },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
  return { synced: items.length };
};
