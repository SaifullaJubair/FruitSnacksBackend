// pathao.webhook.controller.ts
import { Request, Response } from "express";
import crypto from "crypto";
import OrderModel from "../order.model";
import OrderProductModel from "../../orderProducts/orderProduct.model";
import ProductModel from "../../product/product.model";
import VariationModel from "../../variation/variation.model";

const PATHAO_WEBHOOK_SECRET = process.env.PATHAO_WEBHOOK_SECRET || "";

// ── Pathao status → আমাদের order_status ──────────────────────
const pathaoStatusMap: Record<string, string> = {
  "Order Created": "processing",
  "Order Updated": "processing",
  "Pickup Requested": "processing",
  "Assigned For Pickup": "processing",
  Pickup: "processing",
  "Pickup Failed": "processing",
  "Pickup Cancelled": "processing",
  "At the Sorting Hub": "shipped",
  "In Transit": "shipped",
  "Received at Last Mile Hub": "shipped",
  "Assigned for Delivery": "shipped",
  "On Hold": "shipped",
  Delivered: "delivered",
  "Partial Delivery": "delivered",
  Return: "return",
  "Paid Return": "return",
  "Delivery Failed": "cancel",
  Exchange: "processing",
};

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

    // ── Signature verify (production এ enable করো) ────────────
    if (PATHAO_WEBHOOK_SECRET && signature) {
      const isValid = verifyPathaoSignature(
        rawBody,
        signature,
        PATHAO_WEBHOOK_SECRET,
      );
      if (!isValid) {
        console.warn("Pathao webhook: invalid signature");
        // signature invalid হলেও 202 দাও, না হলে Pathao retry করবে
        return respond();
      }
    }

    const payload = req.body;
    console.log("Pathao Webhook received:", JSON.stringify(payload));

    const { event, consignment_id, merchant_order_id, order_status } = payload;

    // webhook_integration test event — শুধু 202 দাও
    if (event === "webhook_integration") {
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

        // ── Inventory কমাও ────────────────────────────────────
        const orderProducts = await OrderProductModel.find({
          order_id: order._id.toString(),
        });

        for (const op of orderProducts) {
          if (!op.variation_id) {
            await ProductModel.updateOne(
              { _id: op.product_id },
              { $inc: { product_quantity: -op.product_quantity } },
            );
          } else {
            await VariationModel.updateOne(
              { _id: op.variation_id },
              { $inc: { variation_quantity: -op.product_quantity } },
            );
          }
        }
      }
      if (newOrderStatus === "cancel") updateData.cancel_time = timeNow;
      if (newOrderStatus === "return") updateData.return_time = timeNow;
    }

    await OrderModel.updateOne({ _id: order._id }, { $set: updateData });

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
