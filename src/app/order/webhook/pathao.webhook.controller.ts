// pathao.webhook.controller.ts
import { Request, Response } from "express";
import crypto from "crypto";
import OrderModel from "../order.model";
import { restockOrder } from "../order.stock";
// Single source of truth — same map the send-service uses. Was duplicated here
// (drift risk); import it instead so the two never diverge.
import { pathaoStatusMap } from "../pathao.service";

const PATHAO_WEBHOOK_SECRET = process.env.PATHAO_WEBHOOK_SECRET || "";

// ── Signature verify ──────────────────────────────────────────
const verifyPathaoSignature = (
  rawBody: string,
  signature: string,
  secret: string,
): boolean => {
  try {
    const hmac = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");
    return hmac === signature;
  } catch {
    return false;
  }
};

// ── Main webhook handler ──────────────────────────────────────
export const pathaoWebhookController = async (req: Request, res: Response) => {
  // Pathao requires 202 response
  const respond = () =>
    res
      .status(202)
      .set(
        "X-Pathao-Merchant-Webhook-Integration-Secret",
        PATHAO_WEBHOOK_SECRET,
      )
      .json({ status: "success", message: "Webhook received." });

  try {
    const signature = req.headers["x-pathao-signature"] as string;
    const rawBody = JSON.stringify(req.body);

    // ── Signature verify (F008 — fail CLOSED) ─────────────────
    // When a secret is configured, every webhook MUST carry a valid signature.
    // Previously an invalid/missing signature was logged but still processed,
    // letting anyone spoof a delivery status / cancel an order. Now we reject.
    // Secret unset (local dev) = check skipped so dev isn't blocked.
    if (PATHAO_WEBHOOK_SECRET) {
      const isValid =
        !!signature &&
        verifyPathaoSignature(rawBody, signature, PATHAO_WEBHOOK_SECRET);
      if (!isValid) {
        console.warn("Pathao webhook: rejected — invalid/missing signature");
        return respond(); // 202 (Pathao requirement) but DO NOT process
      }
    }

    const payload = req.body;
    console.log("Pathao Webhook received:", JSON.stringify(payload));

    const { event, consignment_id, merchant_order_id, order_status } = payload;

    // webhook_integration test event — শুধু 202 দাও
    if (
      event === "webhook_integration" ||
      event === "order.created" ||
      !order_status // order_status নেই এমন যেকোনো event skip করো
    ) {
      return respond();
    }

    // ── Order খুঁজো ───────────────────────────────────────────
    // merchant_order_id = invoice_id, অথবা consignment_id দিয়ে
    let order: any = null;

    if (merchant_order_id) {
      order = await OrderModel.findOne({ invoice_id: merchant_order_id });
    }
    if (!order && consignment_id) {
      order = await OrderModel.findOne({ consignment_id });
    }

    if (!order) {
      console.log(
        `Pathao webhook: order not found. merchant_order_id=${merchant_order_id}, consignment_id=${consignment_id}`,
      );
      return respond();
    }

    // ── Status update ─────────────────────────────────────────
    const newOrderStatus = pathaoStatusMap[order_status];
    const timeNow =
      new Date().toISOString().split("T")[0] +
      " " +
      new Date().toLocaleTimeString();

    const updateData: any = {
      pathao_status: order_status,
    };

    if (newOrderStatus) {
      updateData.order_status = newOrderStatus;

      if (newOrderStatus === "processing" && !order.processing_time) {
        updateData.processing_time = timeNow;
      }
      if (newOrderStatus === "shipped" && !order.shipped_time) {
        updateData.shipped_time = timeNow;
      }
      if (
        newOrderStatus === "delivered" &&
        order.order_status !== "delivered"
      ) {
        updateData.delivered_time = timeNow;
        // Stock already decremented at placement (B2) — no decrement here.
      }
      if (newOrderStatus === "cancel") updateData.cancel_time = timeNow;
      if (newOrderStatus === "return") updateData.return_time = timeNow;
    }

    await OrderModel.updateOne({ _id: order._id }, { $set: updateData });

    // Restock on cancel/return (idempotent via order.stock_restored).
    if (newOrderStatus === "cancel" || newOrderStatus === "return") {
      await restockOrder(order._id);
    }

    console.log(
      `Pathao webhook: order ${merchant_order_id} updated → pathao: ${order_status}, db: ${newOrderStatus}`,
    );

    return respond();
  } catch (error) {
    console.error("Pathao webhook error:", error);
    // error হলেও 202 দাও
    return respond();
  }
};
