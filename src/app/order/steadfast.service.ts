import axios from "axios";
import OrderModel from "../order/order.model";
import ApiError from "../../errors/ApiError";
import mongoose from "mongoose";
import { steadfastStatusMap } from "./webhook/webhook.controller";
import { restockOrder } from "./order.stock";

// Credentials come from the settings document, never from process.env — the
// .env here still holds the PREVIOUS owner's Steadfast keys. See
// courier.config.ts.
import { getSteadfastConfig, SteadfastConfig } from "./courier.config";

// Built per call from the current config. This used to be one object created at
// module load from process.env, so a credential change never took effect until
// the process restarted — the service kept authenticating as whoever the env
// said, forever.
const headersFor = (cfg: SteadfastConfig) => ({
  "Api-Key": cfg.api_key,
  "Secret-Key": cfg.api_secret,
  "Content-Type": "application/json",
});

// ── Helper: phone normalize (01XXXXXXXXX format) ─────────────────────────────
const normalizePhone = (phone: string): string =>
  phone.replace(/^\+?88/, "").replace(/\D/g, "");

// Steadfast এ order পাঠানো
export const sendOrderToSteadfastService = async (
  order_id: string,
  session: mongoose.ClientSession,
): Promise<any> => {
  const order: any =
    await OrderModel.findById(order_id).populate("customer_id");
  if (!order) throw new ApiError(404, "Order Not Found!");

  // ✅ Duplicate check — আগে পাঠানো হয়েছে কিনা
  if (order.courier_type === "steadfast" && order.steadfast_consignment_id) {
    throw new ApiError(
      400,
      `এই order আগেই Steadfast এ পাঠানো হয়েছে। Consignment ID: ${order.steadfast_consignment_id}`,
    );
  }

  // ✅ Already processing/shipped/delivered হলে block করো
  if (["processing", "shipped", "delivered"].includes(order.order_status)) {
    throw new ApiError(
      400,
      `এই order ইতিমধ্যে "${order.order_status}" status এ আছে। আবার পাঠানো যাবে না।`,
    );
  }

  // ── Delivery override — admin set করলে সেটা, না হলে original ──────────────
  const recipientName =
    order.delivery_name || order.customer_id?.user_name || "Customer";
  const recipientPhone = order.delivery_phone || order.customer_phone;
  const altPhone = order.delivery_alt_phone || "";
  const recipientAddress =
    order.delivery_address ||
    `${order.billing_address}, ${order.billing_city}, ${order.billing_state}, ${order.billing_country}`;
  const note = order.delivery_note || "";

  const payload: any = {
    invoice: order.invoice_id,
    recipient_name: recipientName,
    recipient_phone: normalizePhone(recipientPhone),
    recipient_address: recipientAddress,
    cod_amount: order.grand_total_amount,
    note,
  };

  // alternative_phone — Steadfast optional field
  if (altPhone) {
    payload.alternative_phone = normalizePhone(altPhone);
  }

  console.log("Steadfast payload:", payload);

  const cfg = await getSteadfastConfig();
  const response = await axios.post(
    `${cfg.base_url}/create_order`,
    payload,
    { headers: headersFor(cfg) },
  );

  console.log("Steadfast response:", response.data);

  if (response.data?.status !== 200) {
    throw new ApiError(
      400,
      response.data?.message || "Steadfast Order Failed!",
    );
  }

  const consignment = response.data?.consignment;

  if (!consignment?.consignment_id) {
    throw new ApiError(
      500,
      "Steadfast থেকে consignment ID পাওয়া যায়নি। Steadfast portal চেক করুন।",
    );
  }

  const timeNow =
    new Date().toISOString().split("T")[0] +
    " " +
    new Date().toLocaleTimeString();

  await OrderModel.updateOne(
    { _id: order_id },
    {
      steadfast_consignment_id: consignment?.consignment_id,
      steadfast_tracking_code: consignment?.tracking_code,
      steadfast_status: consignment?.status,
      courier_type: "steadfast",
      order_status: "processing",
      processing_time: timeNow,
    },
    { session, runValidators: true },
  );

  return consignment;
};

// ================================================================
// Steadfast bulk send
// ================================================================
export const bulkSendToSteadfastService = async (
  order_ids: string[],
): Promise<any> => {
  const results = {
    success: [] as string[],
    failed: [] as { order_id: string; reason: string }[],
  };

  for (const order_id of order_ids) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await sendOrderToSteadfastService(order_id, session);
      await session.commitTransaction();
      session.endSession();
      results.success.push(order_id);
    } catch (error: any) {
      await session.abortTransaction();
      session.endSession();
      results.failed.push({
        order_id,
        reason: error?.message || "Unknown error",
      });
    }
  }

  return results;
};

// Steadfast tracking
export const trackSteadfastOrderService = async (
  consignment_id: string,
): Promise<any> => {
  const cfg = await getSteadfastConfig();
  const response = await axios.get(
    `${cfg.base_url}/status_by_cid/${consignment_id}`,
    { headers: headersFor(cfg) },
  );
  return response.data;
};

// Steadfast balance check
export const getSteadfastBalanceService = async (): Promise<any> => {
  const cfg = await getSteadfastConfig();
  const response = await axios.get(`${cfg.base_url}/get_balance`, {
    headers: {
      "Api-Key": cfg.api_key,
      "Secret-Key": cfg.api_secret,
    },
  });
  return response.data;
};

// ================================================================
// Steadfast status sync
// ================================================================
export const syncSteadfastOrderService = async (
  order_id: string,
): Promise<any> => {
  const order: any = await OrderModel.findById(order_id);
  if (!order) throw new ApiError(404, "Order Not Found!");

  if (!order.steadfast_consignment_id) {
    throw new ApiError(400, "এই order Steadfast এ পাঠানো হয়নি।");
  }

  const cfg = await getSteadfastConfig();
  const response = await axios.get(
    `${cfg.base_url}/status_by_cid/${order.steadfast_consignment_id}`,
    { headers: headersFor(cfg) },
  );

  const steadfastStatus = response.data?.delivery_status?.toLowerCase();
  if (!steadfastStatus) {
    throw new ApiError(400, "Steadfast থেকে status পাওয়া যায়নি।");
  }

  const newOrderStatus = steadfastStatusMap[steadfastStatus];
  const timeNow =
    new Date().toISOString().split("T")[0] +
    " " +
    new Date().toLocaleTimeString();

  const updateData: any = { steadfast_status: steadfastStatus };

  if (newOrderStatus) {
    updateData.order_status = newOrderStatus;

    if (newOrderStatus === "processing" && !order.processing_time)
      updateData.processing_time = timeNow;
    if (newOrderStatus === "shipped" && !order.shipped_time)
      updateData.shipped_time = timeNow;
    if (newOrderStatus === "delivered") {
      updateData.delivered_time = timeNow;
      // Stock already decremented at placement (B2) — no decrement here.
    }
    if (newOrderStatus === "cancel") updateData.cancel_time = timeNow;
    if (newOrderStatus === "return") updateData.return_time = timeNow;
  }

  await OrderModel.updateOne({ _id: order_id }, { $set: updateData });

  // Restock on cancel/return (idempotent via order.stock_restored).
  if (newOrderStatus === "cancel" || newOrderStatus === "return") {
    await restockOrder(order_id);
  }

  return { steadfast_status: steadfastStatus, order_status: newOrderStatus };
};
