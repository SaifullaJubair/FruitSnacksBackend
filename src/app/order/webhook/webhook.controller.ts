// webhook.controller.ts
import { Request, Response } from "express";
import OrderModel from "../order.model";
import { restockOrder } from "../order.stock";

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
export const steadfastWebhookController = async (
  req: Request,
  res: Response,
) => {
  try {
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
