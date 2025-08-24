import { Schema, model } from "mongoose";
import { IPaymentWithdrawListInterface } from "./paymentWithdrawList.interface";

// payment withdraw list Schema
const PaymentWithdrawListSchema = new Schema<IPaymentWithdrawListInterface>(
  {
    payment_withdraw_amount: {
      type: Number,
      required: true,
    },
    payment_withdraw_status: {
      type: String,
      enum: ["pending", "success", "rejected"],
      default: "pending",
      required: true,
    },
    payment_withdraw_note: {
      type: String,
      required: true,
    },
    payment_withdraw_replay_note: {
      type: String,
    },
    payment_method_id: {
      required: true,
      type: Schema.Types.ObjectId,
      ref: "paymentmethods",
    },
    panel_owner_id: {
      required: true,
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
    payment_withdraw_publisher_id: {
      required: true,
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
  },
  {
    timestamps: true,
  }
);

const PaymentWithdrawListModel = model<IPaymentWithdrawListInterface>(
  "paymentwithdrawlists",
  PaymentWithdrawListSchema
);

export default PaymentWithdrawListModel;
