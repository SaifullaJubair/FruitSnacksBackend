import AbandonedCartModel from "./abandonedCart.model";
import { IAbandonedCartInterface } from "./abandonedCart.interface";

/**
 * Capture (or refresh) an abandoned-cart snapshot. We upsert keyed by phone +
 * "not recovered" so repeat visits update the same row instead of piling up.
 * Returns the freshly-written row.
 */
export const captureAbandonedCartServices = async (
  data: IAbandonedCartInterface,
): Promise<any> => {
  if (!data.customer_phone) {
    // No identifier — nothing useful to recover.
    return null;
  }
  return AbandonedCartModel.findOneAndUpdate(
    { customer_phone: data.customer_phone, recovered: { $ne: true } },
    {
      $set: {
        user_id: data.user_id,
        customer_email: data.customer_email,
        customer_name: data.customer_name,
        items: data.items,
        cart_total: data.cart_total,
        step: data.step || "cart",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

/**
 * Called from order placement after a successful commit — marks any open
 * abandoned-cart row for this phone as recovered + links the order id.
 */
export const markAbandonedCartRecoveredByPhone = async (
  phone: string,
  order_id: any,
): Promise<void> => {
  if (!phone) return;
  await AbandonedCartModel.updateMany(
    { customer_phone: phone, recovered: { $ne: true } },
    { $set: { recovered: true, recovered_order_id: order_id } },
  );
};

export const findAllAbandonedCartServices = async (
  limit = 50,
  skip = 0,
  filters: { recovered?: boolean; min_age_minutes?: number } = {},
): Promise<{ rows: any[]; total: number }> => {
  const where: any = {};
  if (typeof filters.recovered === "boolean") where.recovered = filters.recovered;
  if (filters.min_age_minutes && filters.min_age_minutes > 0) {
    where.createdAt = {
      $lte: new Date(Date.now() - filters.min_age_minutes * 60_000),
    };
  }
  const [rows, total] = await Promise.all([
    AbandonedCartModel.find(where).sort({ createdAt: -1 }).skip(skip).limit(limit),
    AbandonedCartModel.countDocuments(where),
  ]);
  return { rows, total };
};
