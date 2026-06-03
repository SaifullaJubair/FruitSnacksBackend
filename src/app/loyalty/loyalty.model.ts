import { Schema, model } from "mongoose";
import { ILoyaltyTransaction } from "./loyalty.interface";

const loyaltyTxnSchema = new Schema<ILoyaltyTransaction>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },
    delta: { type: Number, required: true },
    type: {
      type: String,
      enum: ["order_earn", "order_redeem", "admin_adjust", "expire"],
      required: true,
    },
    reason: { type: String },
    reference_id: { type: String },
    performed_by: { type: Schema.Types.ObjectId, ref: "admins" },
  },
  { timestamps: true },
);

const LoyaltyTransactionModel = model<ILoyaltyTransaction>(
  "loyalty_transactions",
  loyaltyTxnSchema,
);
export default LoyaltyTransactionModel;
