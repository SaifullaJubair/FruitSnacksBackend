// pathao.webhook.controller.ts
import { Request, Response } from "express";
import crypto from "crypto";
import OrderModel from "../order.model";
import { restockOrder } from "../order.stock";
// Single source of truth — same map the send-service uses. Was duplicated here
// (drift risk); import it instead so the two never diverge.
import { pathaoStatusMap } from "../pathao.service";

// The secret lives in the settings doc (Admin → Settings → Courier), not in
// process.env — the .env here still carries the PREVIOUS owner's Pathao keys.
import { getWebhookSecrets } from "../courier.config";

// ── Signature verify ──────────────────────────────────────────
// Hashes the EXACT bytes Pathao sent (req.rawBody, captured by the express.json
// `verify` hook in index.ts). It used to hash JSON.stringify(req.body) — the
// parsed object re-serialised — which is a different string from the one Pathao
// signed: JSON.stringify drops a trailing zero (1250.50 → 1250.5) and strips
// whitespace. The HMAC therefore never matched, so every genuine webhook was
// rejected and no Pathao delivery status ever landed. The handler still
// answered 202, so nothing looked broken.
//
// timingSafeEqual, not ===, so the comparison can't be probed byte-by-byte.
const verifyPathaoSignature = (
  rawBody: Buffer,
  signature: string,
  secret: string,
): boolean => {
  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

// ── Main webhook handler ──────────────────────────────────────
export const pathaoWebhookController = async (req: Request, res: Response) => {
  const { pathao: secret } = await getWebhookSecrets();

  // Pathao requires a 202 — on accept AND on reject. It also expects its own
  // integration secret echoed back in this header (that is their handshake, not
  // a leak: only a merchant who knows the secret can produce it).
  const respond = () =>
    res
      .status(202)
      .set("X-Pathao-Merchant-Webhook-Integration-Secret", secret)
      .json({ status: "success", message: "Webhook received." });

  try {
    const signature = req.headers["x-pathao-signature"] as string;
    const rawBody: Buffer | undefined = (req as any).rawBody;

    // ── Signature verify (F008 — fail CLOSED) ─────────────────
    // Every webhook MUST carry a valid HMAC signature over the RAW bytes.
    //
    // No secret configured = we cannot verify the caller, so we refuse. This
    // used to skip the check entirely when the secret was unset, which meant a
    // shop that had not configured Pathao yet would happily accept a forged
    // "cancelled" status from anyone and restock the order.
    if (!secret) {
      console.warn(
        "Pathao webhook: rejected — no webhook secret configured (Admin → Settings → Courier)",
      );
      return respond(); // 202 (Pathao requirement) but DO NOT process
    }
    // No rawBody means the express.json `verify` hook in index.ts did not run
    // for this path — the signature cannot be checked, so refuse rather than
    // process an unverifiable payload.
    if (!rawBody) {
      console.warn("Pathao webhook: rejected — raw body unavailable");
      return respond();
    }
    const isValid =
      !!signature && verifyPathaoSignature(rawBody, signature, secret);
    if (!isValid) {
      console.warn("Pathao webhook: rejected — invalid/missing signature");
      return respond(); // 202 (Pathao requirement) but DO NOT process
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
