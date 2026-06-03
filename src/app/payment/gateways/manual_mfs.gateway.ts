/**
 * manual_mfs.gateway.ts — Phase C2.
 *
 * The buyer sends money to the merchant's personal/agent bKash/Nagad/Rocket
 * number, then submits the trxId via `PATCH /order/payment/submit/:id`. An
 * admin verifies and flips the order to `paid` (or `failed` → cancel +
 * restock). No external API — just displays the settings-configured methods.
 */

import ApiError from "../../../errors/ApiError";
import { Gateway, PaymentInitResult } from "../payment.types";

export const manualMfsGateway: Gateway = {
  method: "manual_mfs",
  async initiate(order, settings): Promise<PaymentInitResult> {
    if (!settings?.manual_mfs_enabled) {
      throw new ApiError(400, "Manual MFS payment is not enabled.");
    }
    const methods = settings?.manual_mfs_methods || [];
    if (methods.length === 0) {
      throw new ApiError(
        400,
        "No manual MFS methods configured. Ask admin to add a bKash/Nagad number in Settings.",
      );
    }
    return {
      kind: "instruction",
      manual_instruction: {
        note: settings?.manual_mfs_instruction || undefined,
        methods,
        invoice_id: order.invoice_id || "",
        amount_due: Number(order.grand_total_amount) || 0,
      },
    };
  },
};
