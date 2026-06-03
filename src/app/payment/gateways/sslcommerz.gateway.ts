/**
 * sslcommerz.gateway.ts — Phase C1.
 *
 * SSLCommerz aggregates cards + bKash + Nagad + Rocket behind a single hosted
 * checkout page (so we don't need to touch each MFS API individually). On
 * placement we server-to-server POST the order to their `gwprocess` API; they
 * return a `GatewayPageURL` that we hand to the frontend as a redirect target.
 *
 * Secrets come from `.env` (`SSLCOMMERZ_STORE_ID` / `SSLCOMMERZ_STORE_PASSWORD`)
 * — NOT from the settings doc — so a DB leak alone can't compromise the
 * gateway. The settings doc still holds the `sslcommerz_enabled` +
 * `sslcommerz_sandbox` toggles so admins can switch on/off + flip
 * sandbox/live from the UI.
 *
 * Callback URLs are built off `BACKEND_PUBLIC_URL` (the publicly reachable
 * backend — ngrok in dev, deployed host in prod). The post-callback browser
 * redirect uses `FRONTEND_PUBLIC_URL`.
 *
 * Doc: https://developer.sslcommerz.com/doc/v4/
 */

import axios from "axios";
import ApiError from "../../../errors/ApiError";
import { Gateway, PaymentInitResult } from "../payment.types";

const SANDBOX_BASE = "https://sandbox.sslcommerz.com";
const LIVE_BASE = "https://securepay.sslcommerz.com";

export const sslcommerzBaseUrl = (sandbox: boolean): string =>
  sandbox ? SANDBOX_BASE : LIVE_BASE;

/** Re-exported so the validator + controllers can read the same creds. */
export const sslcommerzCreds = () => {
  const store_id = process.env.SSLCOMMERZ_STORE_ID || "";
  const store_passwd = process.env.SSLCOMMERZ_STORE_PASSWORD || "";
  return { store_id, store_passwd };
};

export const sslcommerzGateway: Gateway = {
  method: "sslcommerz",
  async initiate(order, settings): Promise<PaymentInitResult> {
    if (!settings?.sslcommerz_enabled) {
      throw new ApiError(400, "SSLCommerz payment is not enabled.");
    }
    const { store_id, store_passwd } = sslcommerzCreds();
    if (!store_id || !store_passwd) {
      throw new ApiError(
        500,
        "SSLCommerz credentials missing — set SSLCOMMERZ_STORE_ID + SSLCOMMERZ_STORE_PASSWORD in .env.",
      );
    }

    const sandbox = settings?.sslcommerz_sandbox !== false; // default true
    const base = sslcommerzBaseUrl(sandbox);

    const backendUrl =
      process.env.BACKEND_PUBLIC_URL || "http://localhost:5000";
    const total = Number(order.grand_total_amount) || 0;
    const currency = settings?.currency_code || "BDT";

    // SSLCommerz expects `application/x-www-form-urlencoded`. We use the
    // invoice id as `tran_id` so all our callback handlers can look the order
    // up by invoice without storing extra mappings.
    const params = new URLSearchParams();
    params.set("store_id", store_id);
    params.set("store_passwd", store_passwd);
    params.set("total_amount", String(total));
    params.set("currency", currency);
    params.set("tran_id", order.invoice_id || "");
    params.set("success_url", `${backendUrl}/api/v1/payment/sslcommerz/success`);
    params.set("fail_url", `${backendUrl}/api/v1/payment/sslcommerz/fail`);
    params.set("cancel_url", `${backendUrl}/api/v1/payment/sslcommerz/cancel`);
    params.set("ipn_url", `${backendUrl}/api/v1/payment/sslcommerz/ipn`);
    params.set("shipping_method", "Courier");
    params.set("product_name", `Order ${order.invoice_id}`);
    params.set("product_category", "General");
    params.set("product_profile", "general");
    // Customer info — SSLCommerz requires non-empty values.
    params.set("cus_name", (order as any)?.customer_name || "Customer");
    params.set("cus_email", (order as any)?.customer_email || "noreply@fruitsnacksbd.com");
    params.set("cus_add1", order?.billing_address || "N/A");
    params.set("cus_city", order?.billing_city || "Dhaka");
    params.set("cus_country", order?.billing_country || "Bangladesh");
    params.set("cus_phone", order?.customer_phone || "");
    // Ship info (same defaults — required even for digital orders).
    params.set("ship_name", (order as any)?.customer_name || "Customer");
    params.set("ship_add1", order?.billing_address || "N/A");
    params.set("ship_city", order?.billing_city || "Dhaka");
    params.set("ship_country", order?.billing_country || "Bangladesh");
    params.set("num_of_item", "1");

    const url = `${base}/gwprocess/v4/api.php`;
    const resp = await axios
      .post(url, params.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 15_000,
      })
      .catch((err: any) => {
        throw new ApiError(
          502,
          `SSLCommerz initiate failed: ${err?.response?.data?.failedreason || err?.message || "network error"}`,
        );
      });

    const data: any = resp?.data || {};
    if (data?.status !== "SUCCESS" || !data?.GatewayPageURL) {
      throw new ApiError(
        502,
        `SSLCommerz refused initiate: ${data?.failedreason || data?.status || "unknown"}`,
      );
    }

    return { kind: "redirect", redirect_url: data.GatewayPageURL };
  },
};
