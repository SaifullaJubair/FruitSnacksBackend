// webhook.controller.ts
import { Request, Response } from "express";
import OrderModel from "../order.model";

// Steadfast status → আমাদের order_status mapping

const steadfastStatusMap: Record<string, string> = {
  pending: "processing",
  in_review: "processing",
  partially_delivered: "delivered",
  delivered: "delivered",
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
          updateData.processing_time = timeNow;
        }
        if (newOrderStatus === "delivered") {
          updateData.delivered_time = timeNow;
        }
        if (newOrderStatus === "cancel") {
          updateData.cancel_time = timeNow;
        }
      }

      await OrderModel.updateOne({ invoice_id: invoice }, { $set: updateData });
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
