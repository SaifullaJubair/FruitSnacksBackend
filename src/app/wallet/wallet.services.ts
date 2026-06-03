import mongoose from "mongoose";
import ApiError from "../../errors/ApiError";
import UserModel from "../user/user.model";
import WalletTransactionModel from "./wallet.model";
import { IWalletTransaction } from "./wallet.interface";

/**
 * Atomic credit/debit + ledger row. Throws if a debit would drive the balance
 * negative. Pass a session when called from within a placement/order txn so
 * the wallet move rolls back with the order.
 */
export const moveWallet = async (
  user_id: any,
  delta: number,
  type: IWalletTransaction["type"],
  meta?: { reason?: string; reference_id?: string; performed_by?: any },
  session?: mongoose.ClientSession,
): Promise<{ balance: number; txn: any }> => {
  if (!user_id) throw new ApiError(400, "user_id required");
  if (typeof delta !== "number" || delta === 0) {
    throw new ApiError(400, "delta must be a non-zero number");
  }

  // Atomic guard: refuse a debit that would go below zero.
  const filter: any = { _id: user_id };
  if (delta < 0) filter.wallet_amount = { $gte: -delta };

  const updated = await UserModel.findOneAndUpdate(
    filter,
    { $inc: { wallet_amount: delta } },
    session ? { session, new: true } : { new: true },
  );
  if (!updated) {
    throw new ApiError(
      400,
      delta < 0 ? "Insufficient wallet balance." : "User not found.",
    );
  }

  const txnDocs = await WalletTransactionModel.create(
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

  return { balance: Number(updated.wallet_amount) || 0, txn: txnDocs[0] };
};

export const findWalletHistoryServices = async (
  user_id: any,
  limit = 50,
  skip = 0,
): Promise<{ rows: IWalletTransaction[]; total: number; balance: number }> => {
  const [rows, total, user] = await Promise.all([
    WalletTransactionModel.find({ user_id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    WalletTransactionModel.countDocuments({ user_id }),
    UserModel.findById(user_id).select("wallet_amount").lean(),
  ]);
  return { rows, total, balance: Number((user as any)?.wallet_amount) || 0 };
};
