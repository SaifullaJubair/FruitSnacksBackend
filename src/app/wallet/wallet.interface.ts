/**
 * wallet.interface.ts — Phase E (giftcard / store credit ledger).
 *
 * Every credit/debit on `users.wallet_amount` goes through here so we have an
 * audit trail. Credit on admin top-up or gift card redeem; debit on checkout
 * when the buyer pays from wallet. Type is the reason so reports + support
 * can answer "where did this 200 come from".
 */

import { Types } from "mongoose";

export interface IWalletTransaction {
  _id?: any;
  user_id: Types.ObjectId;
  delta: number; // positive = credit, negative = debit
  type:
    | "admin_credit"
    | "admin_debit"
    | "giftcard_redeem"
    | "order_pay"
    | "order_refund"
    | "referral";
  reason?: string;
  reference_id?: string; // order invoice, giftcard code, ...
  performed_by?: Types.ObjectId; // admin _id if applicable
}
