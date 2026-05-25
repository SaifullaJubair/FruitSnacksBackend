import { Schema, model } from "mongoose";
import { IWalletTransaction } from "./wallet.interface";

const walletTxnSchema = new Schema<IWalletTransaction>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "users", required: true, index: true },
    delta: { type: Number, required: true },
    type: {
      type: String,
      enum: [
        "admin_credit",
        "admin_debit",
        "giftcard_redeem",
        "order_pay",
        "order_refund",
        "referral",
      ],
      required: true,
    },
    reason: { type: String },
    reference_id: { type: String },
    performed_by: { type: Schema.Types.ObjectId, ref: "admins" },
  },
  { timestamps: true },
);

const WalletTransactionModel = model<IWalletTransaction>(
  "wallet_transactions",
  walletTxnSchema,
);
export default WalletTransactionModel;
