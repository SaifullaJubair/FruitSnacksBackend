/**
 * sslcommerz.controllers.ts — Phase C1 callback handlers.
 *
 * Four endpoints SSLCommerz hits after the customer leaves the hosted page:
 *   - success_url → browser POST back here on success
 *   - fail_url    → browser POST on declined payment
 *   - cancel_url  → browser POST when customer clicks "cancel" on the SSL page
 *   - ipn_url     → server-to-server POST (the reliable one; runs even if the
 *                   customer's browser dies before hitting success_url)
 *
 * All four are PUBLIC — anyone could POST anything. We DO NOT trust the
 * callback body; instead we take the `val_id` and re-validate against the
 * SSLCommerz validator API (sslcommerz.validator.ts). Only after the
 * validator says VALID/VALIDATED + amount matches the order's grand total do
 * we flip `payment_status = "paid"`.
 *
 * The success + ipn handlers share `markPaidFromCallback` — idempotent
 * (already-paid orders are skipped silently) so duplicate IPNs are safe.
 * Fail + cancel share `markFailedFromCallback` — cancels the order and
 * triggers `restockOrder` (Phase B helper, also idempotent).
 *
 * Browser-driven callbacks (success/fail/cancel) end with a 302 redirect to
 * the frontend so the customer lands on a friendly page. IPN returns plain
 * 200 — SSLCommerz only needs to know we received it.
 */

import { NextFunction, Request, RequestHandler, Response } from "express";
import mongoose from "mongoose";
import ApiError from "../../errors/ApiError";
import OrderModel from "../order/order.model";
import SettingModel from "../setting/setting.model";
import { restockOrder } from "../order/order.stock";
import { validateSslcommerzTransaction } from "./gateways/sslcommerz.validator";

const fePublic = () =>
  process.env.FRONTEND_PUBLIC_URL || "http://localhost:3000";

const isSandbox = async (): Promise<boolean> => {
  const s: any = await SettingModel.findOne({})
    .select("sslcommerz_sandbox")
    .lean();
  return s?.sslcommerz_sandbox !== false; // default sandbox
};

// ── Shared: mark order paid after validator confirms ─────────────────────────
const markPaidFromCallback = async (body: any) => {
  const tran_id = String(body?.tran_id || "");
  const val_id = String(body?.val_id || "");
  if (!tran_id || !val_id) {
    throw new ApiError(400, "tran_id and val_id are required.");
  }

  const order: any = await OrderModel.findOne({ invoice_id: tran_id });
  if (!order) throw new ApiError(404, "Order not found.");

  // Idempotent — if a prior callback already paid this order, skip.
  if (order.payment_status === "paid") return { already: true, order_id: order._id };

  const sandbox = await isSandbox();
  const v = await validateSslcommerzTransaction(val_id, sandbox);

  if (!v.valid) {
    throw new ApiError(
      400,
      `SSLCommerz validator rejected: ${v.status}`,
    );
  }

  // Confirm the amount the validator returned matches what the order owes —
  // protects against an attacker replaying a small payment against a big order.
  const owed = Number(order.grand_total_amount) || 0;
  if (Math.abs(v.amount - owed) > 0.5) {
    throw new ApiError(
      400,
      `Amount mismatch: validator says ${v.amount}, order owes ${owed}.`,
    );
  }

  await OrderModel.updateOne(
    { _id: order._id },
    {
      $set: {
        payment_status: "paid",
        paid_amount: v.amount,
        paid_at: new Date().toISOString(),
        transaction_id: tran_id,
        "payment_meta.gateway": "sslcommerz",
        "payment_meta.validator": v.raw,
        "payment_meta.callback_body": body,
      },
    },
  );
  return { already: false, order_id: order._id };
};

// ── Shared: mark order failed + restock ──────────────────────────────────────
const markFailedFromCallback = async (body: any, reason: string) => {
  const tran_id = String(body?.tran_id || "");
  if (!tran_id) return; // nothing to do
  const order: any = await OrderModel.findOne({ invoice_id: tran_id });
  if (!order) return;
  if (order.payment_status === "paid") return; // already paid → don't undo
  if (order.payment_status === "failed") return; // already handled

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await OrderModel.updateOne(
      { _id: order._id },
      {
        $set: {
          payment_status: "failed",
          order_status: "cancel",
          cancel_time: new Date().toISOString(),
          "payment_meta.gateway": "sslcommerz",
          "payment_meta.fail_reason": reason,
          "payment_meta.callback_body": body,
        },
      },
      { session },
    );
    await restockOrder(order._id, session);
    await session.commitTransaction();
    session.endSession();
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

// ── Browser callbacks: redirect customer to FE after handling ────────────────
export const sslcommerzSuccess: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const r = await markPaidFromCallback(req.body || {});
    return res.redirect(
      302,
      `${fePublic()}/order-success/${req.body?.tran_id || r.order_id}`,
    );
  } catch (err: any) {
    // Even on validator/amount mismatch we should LAND the customer somewhere.
    return res.redirect(
      302,
      `${fePublic()}/order-failed/${req.body?.tran_id || ""}?reason=${encodeURIComponent(err?.message || "verify failed")}`,
    );
  }
};

export const sslcommerzFail: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await markFailedFromCallback(req.body || {}, "gateway_fail");
  } catch (_) {}
  return res.redirect(
    302,
    `${fePublic()}/order-failed/${req.body?.tran_id || ""}`,
  );
};

export const sslcommerzCancel: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await markFailedFromCallback(req.body || {}, "customer_cancel");
  } catch (_) {}
  return res.redirect(
    302,
    `${fePublic()}/order-failed/${req.body?.tran_id || ""}?reason=cancelled`,
  );
};

// ── IPN: server-to-server. Body has `status` we trust enough to branch on,
// but for "VALID" we still run the validator (defence in depth). Returns
// plain 200 — SSLCommerz just needs an ack.
export const sslcommerzIpn: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const status = String(req.body?.status || "").toUpperCase();
  try {
    if (status === "VALID" || status === "VALIDATED") {
      await markPaidFromCallback(req.body || {});
    } else if (status === "FAILED") {
      await markFailedFromCallback(req.body || {}, "ipn_failed");
    } else if (status === "CANCELLED") {
      await markFailedFromCallback(req.body || {}, "ipn_cancelled");
    }
    return res.status(200).send("ok");
  } catch (err: any) {
    // Log + still 200 so SSLCommerz doesn't keep retrying a bad order id;
    // our DB will reflect what actually happened.
    console.error("sslcommerz IPN error:", err?.message);
    return res.status(200).send("ok");
  }
};
