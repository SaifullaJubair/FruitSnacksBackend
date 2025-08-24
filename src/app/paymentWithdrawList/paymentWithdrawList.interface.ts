import { Types } from "mongoose";
import { IAdminInterface } from "../adminRegLog/admin.interface";
import { IPaymentMethodInterface } from "../withdrow_payment_method/withdrow_payment_method.interface";

export interface IPaymentWithdrawListInterface {
  _id?: any;
  payment_withdraw_amount: number;
  payment_withdraw_status: "pending" | "success" | "rejected";
  payment_withdraw_note: string;
  payment_withdraw_replay_note?: string;
  payment_method_id: Types.ObjectId | IPaymentMethodInterface;
  panel_owner_id: Types.ObjectId | IAdminInterface;
  payment_withdraw_publisher_id: Types.ObjectId | IAdminInterface;
}

export const paymentWithdrawListSearchableField = ["payment_withdraw_status"];
