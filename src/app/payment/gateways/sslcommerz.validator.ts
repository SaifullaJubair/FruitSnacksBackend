/**
 * sslcommerz.validator.ts — Phase C1.
 *
 * SSLCommerz callbacks include a `verify_sign` field, but signature
 * verification alone is brittle (and well-documented as easy to get wrong).
 * The official correct path is to hit their validator API with the `val_id`
 * from the callback and trust ONLY what the validator returns. We do that
 * here; every callback handler runs this before flipping `payment_status`.
 *
 * Doc: https://developer.sslcommerz.com/doc/v4/#validation-of-transaction
 */

import axios from "axios";
import { sslcommerzBaseUrl, sslcommerzCreds } from "./sslcommerz.gateway";

export interface ValidationResult {
  valid: boolean;
  amount: number; // amount the validator confirms was paid
  currency: string;
  status: string; // e.g. "VALID", "VALIDATED", "INVALID_TRANSACTION", ...
  tran_id?: string;
  raw: any; // full validator payload — stored in payment_meta for audit
}

const TERMINAL_OK = new Set(["VALID", "VALIDATED"]);

export const validateSslcommerzTransaction = async (
  val_id: string,
  sandbox: boolean,
): Promise<ValidationResult> => {
  const { store_id, store_passwd } = sslcommerzCreds();
  const base = sslcommerzBaseUrl(sandbox);

  const url =
    `${base}/validator/api/validationserverAPI.php?val_id=` +
    encodeURIComponent(val_id) +
    `&store_id=${encodeURIComponent(store_id)}` +
    `&store_passwd=${encodeURIComponent(store_passwd)}` +
    `&format=json`;

  const resp = await axios.get(url, { timeout: 15_000 }).catch((err: any) => {
    return {
      data: {
        status: "VALIDATOR_HTTP_ERROR",
        _error: err?.message,
      },
    } as any;
  });

  const data: any = resp?.data || {};
  return {
    valid: TERMINAL_OK.has(String(data?.status || "").toUpperCase()),
    amount: Number(data?.amount) || 0,
    currency: String(data?.currency || "BDT"),
    status: String(data?.status || "UNKNOWN"),
    tran_id: data?.tran_id,
    raw: data,
  };
};
