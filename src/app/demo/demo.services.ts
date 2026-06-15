/**
 * demo.services — count + clear the demo catalog seeded by `npm run seed:demo`.
 *
 * EVERYTHING here keys off the `is_demo` flag (reviews off `is_seeded`), NEVER
 * off a name/slug match. This is the safety invariant: a client's REAL rows can
 * never be wiped by this code, even if they happen to share a name with a demo
 * row, because real rows always have is_demo=false.
 *
 * What clear removes:
 *   • demo products  — via deleteProductServices (cascades variations + S3 media)
 *   • demo reviews   — by source:"demo_seed" (NOT is_seeded — that would also
 *                      wipe the client's real csv_bulk/manual_admin seeded
 *                      reviews). Source-based clear still catches orphaned demo
 *                      reviews even if the client manually deleted some demo
 *                      products from the admin first.
 *   • demo banners / sliders / attributes / categories — by is_demo flag
 *
 * What clear KEEPS (by design):
 *   • demo themes      — the client may want to keep a nice demo theme; the
 *                        flag only lets the UI label them as demo-originated.
 *   • demo S3 images   — the demo/<niche>/ folder is shared/reusable across
 *                        clients of the same niche; we only drop DB rows.
 *
 * The seed script imports clearDemoData() to use as its own rollback on a
 * partial failure, so this file must NOT import the seed (no circular dep).
 */

import ProductModel from "../product/product.model";
import ReviewModel from "../review/review.model";
import BannerModel from "../banner/banner.model";
import SliderModel from "../slider/slider.model";
import AttributeModel from "../attribute/attribute.model";
import CategoryModel from "../category/category.model";
import { deleteProductServices } from "../product/product.services";

export interface DemoCounts {
  products: number;
  reviews: number;
  banners: number;
  sliders: number;
  attributes: number;
  categories: number;
}

// Count what a clear WOULD remove — drives the admin confirm dialog preview.
export const countDemoDataServices = async (): Promise<DemoCounts> => {
  const [products, reviews, banners, sliders, attributes, categories] =
    await Promise.all([
      ProductModel.countDocuments({ is_demo: true }),
      ReviewModel.countDocuments({ source: "demo_seed" }),
      BannerModel.countDocuments({ is_demo: true }),
      SliderModel.countDocuments({ is_demo: true }),
      AttributeModel.countDocuments({ is_demo: true }),
      CategoryModel.countDocuments({ is_demo: true }),
    ]);
  return { products, reviews, banners, sliders, attributes, categories };
};

// Remove the whole demo catalog. Returns the counts actually removed.
// Order matters:
//   1. reviews first — they reference products; remove by flag so manually
//      orphaned demo reviews are caught too.
//   2. products next — deleteProductServices cascades variations + S3 media.
//      Looped one-by-one (not deleteMany) so the cascade + theme-counter hooks
//      run per product. Best-effort per product: one failure doesn't abort the
//      rest (we collect and report).
//   3. banners / sliders / attributes / categories — plain deleteMany by flag.
export const clearDemoDataServices = async (): Promise<
  DemoCounts & { product_errors: number }
> => {
  // 1. Reviews by source (orphan-safe; leaves real seeded reviews alone).
  const reviewsRes = await ReviewModel.deleteMany({ source: "demo_seed" });

  // 2. Products one-by-one (cascade).
  const demoProducts = await ProductModel.find({ is_demo: true })
    .select("_id")
    .lean();
  let productsRemoved = 0;
  let productErrors = 0;
  for (const p of demoProducts) {
    try {
      await deleteProductServices(String(p._id));
      productsRemoved += 1;
    } catch (e) {
      productErrors += 1;
      console.warn(`[demo] failed to delete product ${p._id}`, e);
    }
  }

  // 3. The flat catalog rows.
  const [bannersRes, slidersRes, attributesRes, categoriesRes] =
    await Promise.all([
      BannerModel.deleteMany({ is_demo: true }),
      SliderModel.deleteMany({ is_demo: true }),
      AttributeModel.deleteMany({ is_demo: true }),
      CategoryModel.deleteMany({ is_demo: true }),
    ]);

  return {
    products: productsRemoved,
    reviews: reviewsRes.deletedCount || 0,
    banners: bannersRes.deletedCount || 0,
    sliders: slidersRes.deletedCount || 0,
    attributes: attributesRes.deletedCount || 0,
    categories: categoriesRes.deletedCount || 0,
    product_errors: productErrors,
  };
};
