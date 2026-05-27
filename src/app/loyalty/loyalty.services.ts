import mongoose from "mongoose";
import ApiError from "../../errors/ApiError";
import UserModel from "../user/user.model";
import SettingModel from "../setting/setting.model";
import LoyaltyTransactionModel from "./loyalty.model";
import { ILoyaltyTransaction } from "./loyalty.interface";

/**
 * Atomic earn/redeem + ledger. Negative `delta` (redeem) refuses to drive
 * balance < 0. Pass a session for placement-time bumps.
 */
export const moveLoyalty = async (
  user_id: any,
  delta: number,
  type: ILoyaltyTransaction["type"],
  meta?: { reason?: string; reference_id?: string; performed_by?: any },
  session?: mongoose.ClientSession,
): Promise<{ balance: number; txn: any }> => {
  if (!user_id) throw new ApiError(400, "user_id required");
  if (typeof delta !== "number" || delta === 0) {
    throw new ApiError(400, "delta must be non-zero");
  }

  const filter: any = { _id: user_id };
  if (delta < 0) filter.loyalty_points = { $gte: -delta };

  const updated = await UserModel.findOneAndUpdate(
    filter,
    { $inc: { loyalty_points: delta } },
    session ? { session, new: true } : { new: true },
  );
  if (!updated) {
    throw new ApiError(
      400,
      delta < 0 ? "Insufficient loyalty points." : "User not found.",
    );
  }

  const txns = await LoyaltyTransactionModel.create(
    [
      {
        user_id,
        delta,
        type,
        reason: meta?.reason,
        reference_id: meta?.reference_id,
        performed_by: meta?.performed_by,
      },
    ],
    session ? { session } : {},
  );

  return {
    balance: Number(updated.loyalty_points) || 0,
    txn: txns[0],
  };
};

/**
 * Phase G3 (F1b) — debit redeemed points after a successful placement. Called
 * from the order controllers when the recompute step returned a positive
 * `loyalty_redeem_points`. Server-wins style: balance was already inspected at
 * recompute, so this only fires for the clamped value — but we still wrap in
 * try/catch at the call site because a race could in theory drain the balance
 * between recompute and commit. Silent no-op when points == 0.
 */
export const redeemOnOrder = async (
  user_id: any,
  points: number,
  invoice_id: string,
  session?: mongoose.ClientSession,
): Promise<void> => {
  if (!user_id || !points || points <= 0) return;
  await moveLoyalty(
    user_id,
    -Math.floor(points),
    "order_redeem",
    { reason: "order redeem", reference_id: invoice_id },
    session,
  );
};

/**
 * Phase G3 — auto-earn points on a successful order. Called from placement.
 * Reads settings for enabled + earn_rate; silently no-ops when disabled.
 */
export const earnOnOrder = async (
  user_id: any,
  order_total: number,
  invoice_id: string,
  session?: mongoose.ClientSession,
): Promise<void> => {
  if (!user_id || order_total <= 0) return;
  const q = SettingModel.findOne({}).select(
    "loyalty_enabled loyalty_earn_rate",
  );
  const setting: any = session ? await q.session(session) : await q;
  if (!setting?.loyalty_enabled) return;
  const rate = Number(setting.loyalty_earn_rate) || 0;
  if (rate <= 0) return;
  const points = Math.floor(order_total * rate);
  if (points <= 0) return;
  await moveLoyalty(
    user_id,
    points,
    "order_earn",
    { reason: "order earn", reference_id: invoice_id },
    session,
  );
};

export const findMyLoyaltyHistoryServices = async (
  user_id: any,
  limit = 50,
  skip = 0,
): Promise<{ rows: any[]; total: number; balance: number }> => {
  const [rows, total, user] = await Promise.all([
    LoyaltyTransactionModel.find({ user_id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    LoyaltyTransactionModel.countDocuments({ user_id }),
    UserModel.findById(user_id).select("loyalty_points").lean(),
  ]);
  return { rows, total, balance: Number((user as any)?.loyalty_points) || 0 };
};
