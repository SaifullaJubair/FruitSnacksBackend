/**
 * payment.types.ts — gateway-abstraction contract (Phase C).
 *
 * Every payment method (COD, manual MFS, SSLCommerz, bank transfer) implements
 * the SAME `Gateway` interface so the placement controller doesn't care which
 * one was picked — it just calls `initiate(order, settings)` and forwards the
 * `PaymentInitResult` to the frontend. New gateways drop into
 * `payment/gateways/` without touching the order controller.
 *
 * This file is types-only — no logic — kept tiny so it can be imported anywhere
 * (including frontend later) without dragging Mongoose in.
 */

import { IOrderInterface } from "../order/order.interface";
import { ISettingInterface, IManualMfsMethod, IBankAccount } from "../setting/setting.interface";

export type PaymentMethod =
  | "cod"
  | "manual_mfs"
  | "sslcommerz"
  | "bank_transfer";

export interface PaymentInitResult {
  // What the FE should do right now. EXACTLY ONE of these is set per method:
  //  - cod:           kind="none"  (no action needed)
  //  - manual_mfs:    kind="instruction" + manual_instruction
  //  - bank_transfer: kind="instruction" + bank_instruction
  //  - sslcommerz:    kind="redirect"    + redirect_url
  kind: "none" | "instruction" | "redirect";
  manual_instruction?: {
    note?: string;
    methods: IManualMfsMethod[];
    invoice_id: string; // payer uses this as reference
    amount_due: number;
  };
  bank_instruction?: {
    note?: string;
    accounts: IBankAccount[];
    invoice_id: string;
    amount_due: number;
  };
  redirect_url?: string;
}

export interface Gateway {
  method: PaymentMethod;
  /** Called from placement. Returns what FE shows the buyer next. */
  initiate(
    order: Partial<IOrderInterface>,
    settings: Partial<ISettingInterface>,
  ): Promise<PaymentInitResult>;
}
