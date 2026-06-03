/**
 * cod.gateway.ts — cash-on-delivery (Phase C).
 *
 * The default + legacy method. No money moves at checkout; the buyer pays the
 * courier on delivery. Initiate is a no-op — FE just shows the success page.
 */

import { Gateway, PaymentInitResult } from "../payment.types";

export const codGateway: Gateway = {
  method: "cod",
  async initiate(): Promise<PaymentInitResult> {
    return { kind: "none" };
  },
};
