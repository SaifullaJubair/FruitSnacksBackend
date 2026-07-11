// webhook.controller.ts
import { Request, Response } from "express";
import crypto from "crypto";
import OrderModel from "../order.model";
import { restockOrder } from "../order.stock";
import { getWebhookSecrets } from "../courier.config";

// Constant-time compare so the secret can't be recovered a byte at a time by
// timing the response. Length is compared first (that much is unavoidable).
const timingSafeEqualStr = (a: string, b: string): boolean => {
  const ab = Buffer.from(a || "");
  const bb = Buffer.from(b || "");
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
};

// Steadfast status → আমাদের order_status mapping

// webhook.controller.ts
export const steadfastStatusMap: Record<string, string> = {
  in_review: "processing",
  pending: "shipped",
  hold: "shipped",
  delivered_approval_pending: "shipped",
  partial_delivered_approval_pending: "shipped",
  cancelled_approval_pending: "shipped",
  unknown_approval_pending: "shipped",
  delivered: "delivered",
  partial_delivered: "delivered",
  cancelled: "cancel",
  unknown: "processing",
};
// F008 — shared-secret guard. Steadfast does not sign its webhooks, so the
// defense is a secret token the owner appends when registering the webhook URL
// in the Steadfast dashboard (as `?token=…` or an `x-steadfast-webhook-secret`
// header). Without it, anyone could POST a fake "cancelled" status and cancel +
// restock any order in the shop.
//
// FAIL CLOSED. This used to read process.env and skip the check entirely when
// the variable was unset — which is exactly how production ran: the secret was
// never set, so the guard did nothing at all. The secret now lives in the
// settings doc (generated from Admin → Settings → Courier), and no secret means
// we CANNOT verify the caller, so we refuse. A courier that has not been
// configured yet is not sending us webhooks anyway.
export const steadfastWebhookController = async (
  req: Request,
  res: Response,
) => {
  try {
    const { steadfast: secret } = await getWebhookSecrets();

    if (!secret) {
      console.warn(
        "Steadfast webhook: rejected — no webhook secret configured (Admin → Settings → Courier)",
      );
      return res.status(401).json({ status: "error", message: "Unauthorized" });
    }

    const provided =
      (req.query?.token as string) ||
      (req.headers["x-steadfast-webhook-secret"] as string) ||
      "";
    if (!timingSafeEqualStr(provided, secret)) {
      console.warn("Steadfast webhook: rejected — bad/missing secret");
      return res.status(401).json({ status: "error", message: "Unauthorized" });
    }

    const payload = req.body;
    console.log("Steadfast Webhook received:", JSON.stringify(payload));

    const { notification_type, consignment_id, invoice, status, updated_at } =
      payload;

    // ১. invoice দিয়ে order খুঁজো
    const order: any = await OrderModel.findOne({ invoice_id: invoice });

    if (!order) {
      console.log(`Order not found for invoice: ${invoice}`);
      return res.status(200).json({
        status: "success",
        message: "Webhook received successfully.",
      });
    }

    if (notification_type === "delivery_status") {
      const normalizedStatus = status?.toLowerCase();
      const newOrderStatus = steadfastStatusMap[normalizedStatus];

      const updateData: any = {
        steadfast_status: normalizedStatus,
      };

      // order_status update করো
      if (newOrderStatus) {
        updateData.order_status = newOrderStatus;

        // সময় track করো
        const timeNow =
          new Date().toISOString().split("T")[0] +
          " " +
          new Date().toLocaleTimeString();

        if (newOrderStatus === "processing") {
          if (!order.processing_time) {
            updateData.processing_time = timeNow;
          }
        }
        if (newOrderStatus === "shipped") {
          if (!order.shipped_time) {
            updateData.shipped_time = timeNow;
          }
        }

        if (newOrderStatus === "delivered") {
          updateData.delivered_time = timeNow;
          // Stock already decremented at placement (B2) — no decrement here.
        }
        if (newOrderStatus === "cancel") {
          updateData.cancel_time = timeNow;
        }
        if (newOrderStatus === "return") {
          updateData.return_time = timeNow;
        }
      }

      await OrderModel.updateOne({ invoice_id: invoice }, { $set: updateData });

      // Restock on cancel/return (idempotent via order.stock_restored).
      if (newOrderStatus === "cancel" || newOrderStatus === "return") {
        await restockOrder(order._id);
      }
      console.log(
        `Order ${invoice} updated → steadfast: ${normalizedStatus}, db: ${newOrderStatus}`,
      );
    }

    if (notification_type === "tracking_update") {
      // tracking message save করো (optional)
      await OrderModel.updateOne(
        { invoice_id: invoice },
        {
          $set: {
            steadfast_tracking_message: payload?.tracking_message,
          },
        },
      );
      console.log(
        `Tracking update for ${invoice}: ${payload?.tracking_message}`,
      );
    }

    // Steadfast কে 200 দিতেই হবে নইলে বারবার retry করবে
    return res.status(200).json({
      status: "success",
      message: "Webhook received successfully.",
    });
  } catch (error) {
    console.error("Steadfast webhook error:", error);
    // এখানেও 200 দাও — না হলে Steadfast বারবার পাঠাবে
    return res.status(200).json({
      status: "success",
      message: "Webhook received successfully.",
    });
  }
};
