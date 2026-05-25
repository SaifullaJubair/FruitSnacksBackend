/**
 * bank_transfer.gateway.ts — Phase C4.
 *
 * The buyer sends money to one of the merchant's bank accounts and uploads a
 * deposit-slip screenshot (handled by the `/payment/submit-with-screenshot`
 * route). Admin then verifies via the shared C2 admin-verify endpoint —
 * "paid" or "failed" (failed → cancel + Phase-B restock). No external API,
 * just displays the configured bank accounts via the standard
 * `kind:"instruction"` shape.
 */

import ApiError from "../../../errors/ApiError";
import { Gateway, PaymentInitResult } from "../payment.types";

export const bankTransferGateway: Gateway = {
  method: "bank_transfer",
  async initiate(order, settings): Promise<PaymentInitResult> {
    if (!settings?.bank_transfer_enabled) {
      throw new ApiError(400, "Bank transfer payment is not enabled.");
    }
    const accounts = settings?.bank_accounts || [];
    if (accounts.length === 0) {
      throw new ApiError(
        400,
        "No bank accounts configured. Ask admin to add a bank account in Settings.",
      );
    }
    return {
      kind: "instruction",
      bank_instruction: {
        note: (settings as any)?.bank_transfer_instruction || undefined,
        accounts,
        invoice_id: order.invoice_id || "",
        amount_due: Number(order.grand_total_amount) || 0,
      },
    };
  },
};
