import mongoose from "mongoose";
import ApiError from "../../errors/ApiError";
import FlashSaleModel from "./flashsale.model";
import ProductModel from "../product/product.model";
import {
  IFlashSaleInterface,
  flashSaleSearchableField,
} from "./flashsale.interface";

export const postFlashSaleServices = async (
  data: IFlashSaleInterface,
): Promise<any> => FlashSaleModel.create(data);

export const findAllFlashSaleServices = async (
  limit: number,
  skip: number,
  searchTerm: any,
): Promise<any> => {
  const andCondition: any[] = [];
  if (searchTerm) {
    andCondition.push({
      $or: flashSaleSearchableField.map((f) => ({
        [f]: { $regex: searchTerm, $options: "i" },
      })),
    });
  }
  const where = andCondition.length ? { $and: andCondition } : {};
  return FlashSaleModel.find(where).sort({ createdAt: -1 }).skip(skip).limit(limit);
};

export const findAFlashSaleServices = async (
  _id: string,
): Promise<any> => {
  const r = await FlashSaleModel.findById(_id);
  if (!r) throw new ApiError(404, "Flash sale not found");
  return r;
};

export const updateFlashSaleServices = async (
  _id: string,
  data: Partial<IFlashSaleInterface>,
): Promise<any> => FlashSaleModel.updateOne({ _id }, { $set: data }, { runValidators: true });

export const deleteFlashSaleServices = async (_id: string): Promise<any> =>
  FlashSaleModel.deleteOne({ _id });

/**
 * Batch helper for home strips: given an array of product ObjectIds, returns
 * a Map<product_id_string, flash_sale_details> for every product that has an
 * active flash entry right now. Single DB query — one active flash sale doc
 * is fetched and matched in-memory, so N products = 1 query regardless.
 */
export const findActiveFlashMapForProducts = async (
  productIds: any[],
): Promise<Map<string, { flash_sale_product_price: number; flash_price_type: "fixed" | "percent"; flash_sale_title: string; flash_sale_end_time: Date }>> => {
  const result = new Map();
  if (!productIds?.length) return result;

  const now = new Date();
  const idStrings = new Set(productIds.map((id: any) => String(id)));

  // Fetch all active flash sales that contain ANY of these products.
  const sales: any[] = await FlashSaleModel.find({
    status: "active",
    start_at: { $lte: now },
    end_at: { $gte: now },
    "products.product_id": { $in: productIds },
    "products.active": true,
  })
    .select("title end_at products")
    .lean();

  for (const sale of sales) {
    for (const entry of sale.products || []) {
      const idStr = String(entry.product_id);
      if (entry.active !== false && idStrings.has(idStr) && !result.has(idStr)) {
        result.set(idStr, {
          flash_sale_product_price: entry.flash_price,
          flash_price_type: entry.flash_price_type,
          flash_sale_title: sale.title,
          flash_sale_end_time: sale.end_at,
        });
      }
    }
  }
  return result;
};

/**
 * Resolver-side helper: find the active flash sale entry for a product, if any.
 * Returns `null` when no active flash applies. Cached-friendly (single query).
 */
export const findActiveFlashForProduct = async (
  product_id: any,
  session?: mongoose.ClientSession,
): Promise<{ flash_price: number; flash_price_type: "fixed" | "percent" } | null> => {
  const now = new Date();
  const q = FlashSaleModel.findOne({
    status: "active",
    start_at: { $lte: now },
    end_at: { $gte: now },
    "products.product_id": product_id,
    "products.active": true,
  }).select("products.$");
  const sale: any = session ? await q.session(session) : await q;
  if (!sale || !sale.products?.[0]) return null;
  const p = sale.products[0];
  return { flash_price: p.flash_price, flash_price_type: p.flash_price_type };
};

/**
 * Storefront endpoint — returns the currently active flash sale with
 * populated product data in the shape FlashSale.jsx expects.
 * Shape: { flash_sale_title, flash_sale_start_time, flash_sale_end_time,
 *          flash_sale_products: [{ flash_sale_product: {...}, flash_price, flash_price_type }] }
 */
export const findActiveFlashSaleStorefrontService = async (): Promise<any> => {
  const now = new Date();
  const sale: any = await FlashSaleModel.findOne({
    status: "active",
    start_at: { $lte: now },
    end_at: { $gte: now },
  })
    .select("title start_at end_at products")
    .lean();

  if (!sale) return null;

  const activeEntries = (sale.products || []).filter(
    (p: any) => p.active !== false,
  );
  if (!activeEntries.length) return null;

  const productIds = activeEntries.map((p: any) => p.product_id);
  const products: any[] = await ProductModel.find({
    _id: { $in: productIds },
    product_status: "active",
  })
    .select(
      "product_name product_slug main_image is_variation product_price product_discount_price total_review rating_count brand_id variations",
    )
    .populate({ path: "brand_id", select: "brand_name" })
    .lean();

  const productMap = new Map(products.map((p: any) => [String(p._id), p]));

  const flash_sale_products = activeEntries
    .map((entry: any) => {
      const prod = productMap.get(String(entry.product_id));
      if (!prod) return null;
      return {
        flash_price: entry.flash_price,
        flash_price_type: entry.flash_price_type,
        flash_sale_product: {
          _id: prod._id,
          product_name: prod.product_name,
          product_slug: prod.product_slug,
          main_image: prod.main_image,
          is_variation: prod.is_variation,
          product_price: prod.product_price,
          product_discount_price: prod.product_discount_price,
          brand: prod.brand_id,
          variations: (prod.variations || []).slice(0, 1).map((v: any) => ({
            variation_price: v.variation_price,
            variation_discount_price: v.variation_discount_price,
          })),
        },
        rating: prod.rating_count || 0,
        reviews: prod.total_review || 0,
      };
    })
    .filter(Boolean);

  return {
    flash_sale_title: sale.title,
    flash_sale_start_time: sale.start_at,
    flash_sale_end_time: sale.end_at,
    flash_sale_products,
  };
};

/**
 * PDP-side helper (Phase E / F2): same active-flash lookup but returns the
 * sale's countdown metadata (title + start_at + end_at) alongside the product
 * entry. Used by `findAProductDetailsServices` so the storefront can render
 * the flash badge + countdown without a second round-trip.
 */
export const findActiveFlashWithMetaForProduct = async (
  product_id: any,
): Promise<{
  title: string;
  start_at: Date;
  end_at: Date;
  product_entry: {
    flash_price: number;
    flash_price_type: "fixed" | "percent";
    active?: boolean;
  };
} | null> => {
  const now = new Date();
  const sale: any = await FlashSaleModel.findOne({
    status: "active",
    start_at: { $lte: now },
    end_at: { $gte: now },
    "products.product_id": product_id,
    "products.active": true,
  })
    .select("title start_at end_at products")
    .lean();
  if (!sale) return null;
  const entry = (sale.products || []).find(
    (p: any) =>
      String(p.product_id) === String(product_id) && p.active !== false,
  );
  if (!entry) return null;
  return {
    title: sale.title,
    start_at: sale.start_at,
    end_at: sale.end_at,
    product_entry: {
      flash_price: entry.flash_price,
      flash_price_type: entry.flash_price_type,
      active: entry.active,
    },
  };
};
