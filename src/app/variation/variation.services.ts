import VariationModel from "./variation.model";
import { IVariationInterface } from "./variation.interface";

/**
 * Rows for the admin Page Content variation table. Its only consumer.
 *
 * Projected, not the whole doc: the table shows name / weight / badge / price /
 * stock, and has no business shipping variation_buying_price (the shop's cost
 * price), SKU or barcode to the browser. The route is admin-authenticated now,
 * so this is defence in depth rather than the fix — but there's no reason for
 * the margin to leave the server on this call.
 */
export const findVariationsByProductService = async (productId: string) => {
  return VariationModel.find({ product_id: productId })
    .select(
      "_id variation_name variation_weight_grams variation_badge_text variation_badge_icon_key variation_price variation_discount_price variation_quantity",
    )
    .lean();
};

export const updateVariationService = async (
  _id: string,
  data: Partial<IVariationInterface>,
) => {
  return VariationModel.updateOne({ _id }, data, { runValidators: true });
};

export type BulkVariationRow = {
  _id: string;
  variation_weight_grams?: number | null;
  variation_badge_text?: string | null;
  variation_badge_icon_key?: string | null;
};

/**
 * Bulk-save the page-content-editable variation fields in one round trip.
 *
 * Deliberately narrow: it `$set`s ONLY the three fields the Page Content
 * editor owns. The full product-update path spreads a whole variation row into
 * `updateOne`, which means a stale form there can clobber price / stock / SKU.
 * This path must never be able to do that — hence no spread, no passthrough.
 *
 * `bulkWrite` so N rows cost one round trip, and so we get back a real
 * matchedCount: a row whose _id no longer exists (another admin deleted the
 * variation while this form was open) shows up as unmatched rather than
 * silently reporting success.
 */
export const bulkUpdateVariationsService = async (
  rows: BulkVariationRow[],
): Promise<{ matched: number; modified: number; missingIds: string[] }> => {
  if (!rows.length) return { matched: 0, modified: 0, missingIds: [] };

  const ids = rows.map((r) => r._id);
  const existing = await VariationModel.find({ _id: { $in: ids } })
    .select("_id")
    .lean();
  const existingIds = new Set(existing.map((d: any) => String(d._id)));
  const missingIds = ids.filter((id) => !existingIds.has(String(id)));

  // All-or-nothing. A missing _id means another admin deleted that variation
  // while this form was open, so the admin's view of the table is stale. Write
  // NOTHING and make them reload — writing "the rows that still exist" would
  // half-apply an edit the admin made against a layout that no longer holds,
  // and the caller reports the failure as "nothing was saved".
  if (missingIds.length) return { matched: 0, modified: 0, missingIds };

  const ops = rows
    .filter((r) => existingIds.has(String(r._id)))
    .map((r) => {
      const $set: Record<string, any> = {};
      // `undefined` = the client did not send this field, leave it alone.
      // `null` = an explicit clear. Both are meaningful, so test for presence.
      if (r.variation_weight_grams !== undefined) {
        $set.variation_weight_grams = r.variation_weight_grams;
      }
      if (r.variation_badge_text !== undefined) {
        $set.variation_badge_text = r.variation_badge_text;
      }
      if (r.variation_badge_icon_key !== undefined) {
        $set.variation_badge_icon_key = r.variation_badge_icon_key;
      }
      return {
        updateOne: {
          filter: { _id: r._id },
          update: { $set },
        },
      };
    })
    .filter((op) => Object.keys(op.updateOne.update.$set).length > 0);

  if (!ops.length) return { matched: 0, modified: 0, missingIds };

  const res: any = await VariationModel.bulkWrite(ops, { ordered: false });
  return {
    matched: res?.matchedCount ?? 0,
    modified: res?.modifiedCount ?? 0,
    missingIds,
  };
};
