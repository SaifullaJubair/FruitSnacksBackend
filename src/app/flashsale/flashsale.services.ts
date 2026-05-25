import mongoose from "mongoose";
import ApiError from "../../errors/ApiError";
import FlashSaleModel from "./flashsale.model";
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
