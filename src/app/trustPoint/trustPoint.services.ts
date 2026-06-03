import { ITrustPointItem } from "./trustPoint.interface";
import TrustPointModel from "./trustPoint.model";

// Always return the single trust-point document, creating an empty one on
// first access so the admin/storefront always has something to read.
export const getTrustPointsService = async () => {
  let doc: any = await TrustPointModel.findOne({}).lean();
  if (!doc) {
    const created = await TrustPointModel.create({ points: [] });
    doc = created.toObject();
  }
  return doc;
};

// Max tiles the NutritionSection 2×3 trust grid is designed for. Enforced here
// so the DB never holds more than the storefront can cleanly render (the
// frontend also slices to this number as a safety net).
const MAX_TRUST_POINTS = 6;

// Replace the whole list (upsert the singleton). `points` is sanitized so only
// known fields are stored, fully-empty rows are dropped, and the list is capped
// at MAX_TRUST_POINTS.
export const updateTrustPointsService = async (
  points: ITrustPointItem[],
  updatedBy?: any,
) => {
  const clean = (Array.isArray(points) ? points : [])
    .map((p) => ({
      icon_key: p?.icon_key || "",
      icon_url: p?.icon_url || "",
      title: p?.title || "",
      subtitle: p?.subtitle || "",
    }))
    .filter((p) => p.icon_key || p.icon_url || p.title || p.subtitle)
    .slice(0, MAX_TRUST_POINTS);

  const updated = await TrustPointModel.findOneAndUpdate(
    {},
    { $set: { points: clean, _updated_by: updatedBy } },
    { new: true, upsert: true },
  ).lean();

  return updated;
};
