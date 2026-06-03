/**
 * loyalty.interface.ts — Phase G3.
 *
 * Points ledger. Earn on completed orders, redeem at checkout. Conversion rate
 * + earn rate come from settings (Phase G3 setting fields). Kept separate from
 * `wallet_amount` so reports can split "store credit / refunds" vs "loyalty
 * rewards" without spelunking through transaction reasons.
 */

import { Types } from "mongoose";

export interface ILoyaltyTransaction {
  _id?: any;
  user_id: Types.ObjectId;
  delta: number; // positive = earn, negative = redeem
  type: "order_earn" | "order_redeem" | "admin_adjust" | "expire";
  reason?: string;
  reference_id?: string; // order invoice id, ...
  performed_by?: Types.ObjectId;
}
