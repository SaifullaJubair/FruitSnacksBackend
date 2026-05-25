/**
 * payment.service.ts — central dispatcher + admin-verify / customer-submit
 * logic (Phase C). The placement controller calls `initiatePayment()`; the
 * /order/payment/* routes call `submitTransaction()` / `verifyPayment()`.
 *
 * Adding a new method: implement a `Gateway`, drop it in `gateways/`, and add
 * one line to the `gateways` map below. The order controller stays untouched.
 */

import mongoose from "mongoose";
import ApiError from "../../errors/ApiError";
import OrderModel from "../order/order.model";
import SettingModel from "../setting/setting.model";
import { restockOrder } from "../order/order.stock";
import { Gateway, PaymentInitResult, PaymentMethod } from "./payment.types";
import { codGateway } from "./gateways/cod.gateway";
import { manualMfsGateway } from "./gateways/manual_mfs.gateway";
import { sslcommerzGateway } from "./gateways/sslcommerz.gateway";
import { bankTransferGateway } from "./gateways/bank_transfer.gateway";
import { IOrderInterface } from "../order/order.interface";

// One source of truth — registry of all supported gateways.
const gateways: Record<PaymentMethod, Gateway> = {
  cod: codGateway,
  manual_mfs: manualMfsGateway,
  sslcommerz: sslcommerzGateway,
  bank_transfer: bankTransferGateway,
};

const resolveGateway = (method?: PaymentMethod): Gateway => {
  const m = (method || "cod") as PaymentMethod;
  const g = gateways[m];
  if (!g) throw new ApiError(400, `Payment method "${m}" is not available yet.`);
  return g;
};

/**
 * Called from placement (postOrder / postSingleOrder) AFTER the order doc has
 * been saved. Picks the right gateway and returns FE-facing init info.
 */
export const initiatePayment = async (
  order: Partial<IOrderInterface>,
): Promise<PaymentInitResult> => {
  const setting: any = await SettingModel.findOne({}).lean();
  const gateway = resolveGateway(order.payment_method as PaymentMethod);
  return gateway.initiate(order, setting || {});
};

/**
 * Phase C3 — initiate a separate payment flow for the ADVANCE amount only
 * (so the order itself stays `payment_method:"cod"` while the advance gets
 * charged via a real gateway). We pass a synthetic order object where
 * `grand_total_amount = advance_amount` so the gateway initiates for the
 * right amount, and `payment_method` is the chosen advance method.
 */
export const initiateAdvancePayment = async (
  order: Partial<IOrderInterface>,
  advance_method: PaymentMethod,
  advance_amount: number,
): Promise<PaymentInitResult> => {
  const setting: any = await SettingModel.findOne({}).lean();
  const gateway = resolveGateway(advance_method);
  return gateway.initiate(
    {
      ...order,
      payment_method: advance_method,
      grand_total_amount: advance_amount,
    },
    setting || {},
  );
};

/**
 * Customer submits their MFS trxId (or bank reference) after sending money.
 * Flips status to "pending" (awaiting admin verify). Public — gated by the
 * caller knowing the order id (typical e-commerce pattern; phone-match check
 * is a later hardening pass).
 */
export const submitTransaction = async (
  order_id: string,
  body: {
    transaction_id: string;
    method_name?: string;
    payer_number?: string;
    // Phase C4: optional deposit-slip screenshot (S3 URL + key for later delete).
    screenshot_url?: string;
    screenshot_key?: string;
  },
) => {
  if (!body?.transaction_id) {
    throw new ApiError(400, "transaction_id is required.");
  }
  const order: any = await OrderModel.findById(order_id);
  if (!order) throw new ApiError(404, "Order not found.");
  if (order.payment_status === "paid") {
    throw new ApiError(400, "Order is already paid.");
  }
  if (order.payment_method === "cod") {
    throw new ApiError(400, "COD orders don't take a transaction id.");
  }

  await OrderModel.updateOne(
    { _id: order_id },
    {
      $set: {
        transaction_id: body.transaction_id,
        payment_status: "pending",
        "payment_meta.submitted_at": new Date().toISOString(),
        "payment_meta.method_name": body.method_name,
        "payment_meta.payer_number": body.payer_number,
        "payment_meta.screenshot_url": body.screenshot_url,
        "payment_meta.screenshot_key": body.screenshot_key,
      },
    },
  );
  return { ok: true };
};

/**
 * Admin verify (or decline) a submitted payment. On "failed" we cancel the
 * order AND restock through the Phase-B helper — so the stock that was held
 * at placement is released immediately. On "paid" we set paid_amount + paid_at.
 */
export const verifyPayment = async (
  order_id: string,
  body: { decision: "paid" | "failed"; paid_amount?: number; note?: string },
  admin_id?: string,
) => {
  if (body?.decision !== "paid" && body?.decision !== "failed") {
    throw new ApiError(400, 'decision must be "paid" or "failed".');
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order: any = await OrderModel.findById(order_id).session(session);
    if (!order) throw new ApiError(404, "Order not found.");

    const now = new Date().toISOString();
    const verifyTrail = {
      "payment_meta.verified_at": now,
      "payment_meta.verified_by": admin_id,
      "payment_meta.verify_note": body.note,
    };

    if (body.decision === "paid") {
      // Phase C3 partial flow: a COD order with a pending advance flips to
      // "partial" first (only the advance was paid online). A subsequent
      // "paid" call (e.g. courier confirms COD-rest received) flips it the
      // rest of the way to fully paid.
      const isAdvanceLeg =
        order.payment_method === "cod" &&
        Number(order.advance_amount) > 0 &&
        order.payment_status !== "partial" &&
        order.payment_status !== "paid";

      const totalOwed = Number(order.grand_total_amount) || 0;
      const advanceOwed = Number(order.advance_amount) || 0;
      const incoming =
        typeof body.paid_amount === "number"
          ? body.paid_amount
          : isAdvanceLeg
            ? advanceOwed
            : totalOwed - Number(order.paid_amount || 0);

      const newPaidAmount = Number(order.paid_amount || 0) + incoming;
      const newStatus = newPaidAmount >= totalOwed ? "paid" : "partial";

      await OrderModel.updateOne(
        { _id: order_id },
        {
          $set: {
            payment_status: newStatus,
            paid_amount: newPaidAmount,
            paid_at: now,
            ...verifyTrail,
          },
        },
        { session },
      );
    } else {
      // failed → cancel + restock (reuses Phase-B helper, idempotent).
      await OrderModel.updateOne(
        { _id: order_id },
        {
          $set: {
            payment_status: "failed",
            order_status: "cancel",
            cancel_time: now,
            ...verifyTrail,
          },
        },
        { session },
      );
      await restockOrder(order_id, session);
    }

    await session.commitTransaction();
    session.endSession();
    return { ok: true, decision: body.decision };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};
