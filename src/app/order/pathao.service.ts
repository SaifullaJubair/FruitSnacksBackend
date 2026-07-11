import axios from "axios";
import mongoose from "mongoose";
import ApiError from "../../errors/ApiError";
import OrderModel from "../order/order.model";
import OrderProductModel from "../orderProducts/orderProduct.model";
import { restockOrder } from "./order.stock";

// Credentials come from the settings document, never from process.env — the
// .env here still holds the PREVIOUS owner's Pathao keys, and falling back to
// them would ship this shop's parcels on someone else's account. See
// courier.config.ts.
import { getPathaoConfig, PathaoConfig } from "./courier.config";

// ── Helper: phone normalize (01XXXXXXXXX format) ─────────────────────────────
const normalizePhone = (phone: string): string =>
  phone.replace(/^\+?88/, "").replace(/\D/g, "");

// ================================================================
// Token Cache
// ================================================================
// Keyed by the credentials that produced the token. The cache used to be a bare
// module-level string, so when an admin corrected the Pathao credentials the old
// token stayed valid for up to an hour — orders kept flowing to the OLD account
// with no sign anything was wrong. Keying on the creds means new credentials
// simply miss the cache.
let cachedToken: string | null = null;
let cachedTokenKey = "";
let tokenExpiry = 0;

const credsKey = (c: PathaoConfig) =>
  `${c.base_url}|${c.client_id}|${c.username}`;

const getPathaoAccessToken = async (cfg: PathaoConfig): Promise<string> => {
  const now = Date.now();
  const key = credsKey(cfg);
  if (cachedToken && cachedTokenKey === key && now < tokenExpiry - 5 * 60 * 1000)
    return cachedToken;

  try {
    const response = await axios.post(`${cfg.base_url}/issue-token`, {
      client_id: cfg.client_id,
      client_secret: cfg.client_secret,
      username: cfg.username,
      password: cfg.password,
      grant_type: "password",
    });

    if (!response.data?.access_token)
      throw new ApiError(400, "Pathao Token নেওয়া ব্যর্থ হয়েছে!");

    cachedToken = response.data.access_token;
    cachedTokenKey = key;
    const expiresIn = response.data?.expires_in || 3600;
    tokenExpiry = now + expiresIn * 1000;
    return cachedToken!;
  } catch (error: any) {
    console.error("Pathao token error:", error.response?.data);
    throw new ApiError(
      400,
      error.response?.data?.message || "Pathao Token নেওয়া ব্যর্থ হয়েছে!",
    );
  }
};

// ================================================================
// Pathao order status → আমাদের order_status mapping
// ================================================================
export const pathaoStatusMap: Record<string, string> = {
  Pending: "processing",
  "Order Created": "processing",
  "Order Updated": "processing",
  "Pickup Requested": "processing",
  "Pickup Scheduled": "processing",
  "Assigned For Pickup": "processing",
  "Pickup Failed": "processing",
  "Pickup Cancel": "cancel",
  "Pickup Cancelled": "cancel",
  Exchange: "processing",
  Pickup: "shipped",
  "Picked Up": "shipped",
  "At the Sorting Hub": "shipped",
  "In Transit": "shipped",
  "Received at Last Mile Hub": "shipped",
  "Assigned for Delivery": "shipped",
  "Out for Delivery": "shipped",
  "On Hold": "shipped",
  Hold: "shipped",
  Delivered: "delivered",
  "Partial Delivery": "delivered",
  "Partially Delivered": "delivered",
  Return: "return",
  Returned: "return",
  "Paid Return": "return",
  "Partially Returned": "return",
  "Delivery Failed": "cancel",
  Cancelled: "cancel",
  "Delivery Cancelled": "cancel",
};

// ================================================================
// Pathao এ single order পাঠাও
// ================================================================
export const sendOrderToPathaoService = async (
  order_id: string,
  session: mongoose.ClientSession,
): Promise<any> => {
  const order: any =
    await OrderModel.findById(order_id).populate("customer_id");
  if (!order) throw new ApiError(404, "Order Not Found!");

  if (order.courier_type === "pathao" && order.consignment_id) {
    throw new ApiError(
      400,
      `এই order আগেই Pathao তে পাঠানো হয়েছে। Consignment ID: ${order.consignment_id}`,
    );
  }

  if (["processing", "shipped", "delivered"].includes(order.order_status)) {
    throw new ApiError(
      400,
      `এই order ইতিমধ্যে "${order.order_status}" status এ আছে।`,
    );
  }

  if (!order.pathao_city_id || !order.pathao_zone_id) {
    throw new ApiError(
      400,
      "এই order এ Pathao city/zone সেট করা নেই। Order details চেক করুন।",
    );
  }

  // ── Delivery override — admin set করলে সেটা, না হলে original ──────────────
  const recipientName =
    order.delivery_name || order.customer_id?.user_name || "Customer";
  const recipientPhone = order.delivery_phone || order.customer_phone;
  const recipientAddress = order.delivery_address || order.billing_address;
  const specialNote = order.delivery_note
    ? `${order.delivery_note} | Invoice: ${order.invoice_id}`
    : `Invoice: ${order.invoice_id}`;

  const altPhone = order.delivery_alt_phone || "";

  const cfg = await getPathaoConfig();
  const accessToken = await getPathaoAccessToken(cfg);

  // ── Compute item_weight (kg) and item_quantity from order line items ───────
  // Each variation may carry `variation_weight_grams`. Fallback per item: 500g.
  const orderProducts = await OrderProductModel.find({ order_id: order._id })
    .populate({ path: "variation_id", select: "variation_weight_grams variation_name" })
    .lean();

  let totalGrams = 0;
  let totalQty = 0;
  const missingWeightItems: string[] = [];

  for (const op of orderProducts) {
    const qty = op.product_quantity || 1;
    totalQty += qty;
    const variation: any = op.variation_id;
    const grams = variation?.variation_weight_grams;
    if (typeof grams === "number" && grams > 0) {
      totalGrams += grams * qty;
    } else {
      totalGrams += 500 * qty; // fallback 500g per unit
      missingWeightItems.push(variation?.variation_name || op.product_id?.toString());
    }
  }

  if (missingWeightItems.length) {
    console.warn(
      `[pathao] Missing variation_weight_grams for: ${missingWeightItems.join(", ")} — using 500g fallback per unit. Update variation weight in admin panel.`,
    );
  }

  const item_weight = Math.max(0.5, totalGrams / 1000);
  const item_quantity = Math.max(1, totalQty);

  const payload = {
    store_id: cfg.store_id,
    merchant_order_id: order.invoice_id,
    recipient_name: recipientName,
    recipient_phone: normalizePhone(recipientPhone),
    recipient_secondary_phone: (altPhone && normalizePhone(altPhone)) || "",
    recipient_address: recipientAddress,
    recipient_city: order.pathao_city_id,
    recipient_zone: order.pathao_zone_id,
    delivery_type: 48,
    item_type: 2,
    special_instruction: specialNote,
    item_quantity,
    item_weight,
    amount_to_collect: order.grand_total_amount,
    item_description: `Order ${order.invoice_id}`,
  };

  try {
    const response = await axios.post(`${cfg.base_url}/orders`, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (response.data?.code !== 200) {
      const errMsg =
        response.data?.message?.error_list?.join(", ") ||
        response.data?.message ||
        "Pathao Order Failed!";
      throw new ApiError(400, errMsg);
    }

    const consignment = response.data?.data;

    if (!consignment?.consignment_id) {
      throw new ApiError(
        500,
        "Pathao থেকে consignment ID পাওয়া যায়নি। Pathao portal চেক করুন।",
      );
    }

    const timeNow =
      new Date().toISOString().split("T")[0] +
      " " +
      new Date().toLocaleTimeString();

    await OrderModel.updateOne(
      { _id: order_id },
      {
        consignment_id: consignment?.consignment_id,
        tracking_code: consignment?.order_tracking_code,
        courier_type: "pathao",
        order_status: "processing",
        processing_time: timeNow,
        pathao_status: "Pending",
      },
      { session, runValidators: true },
    );

    return consignment;
  } catch (error: any) {
    console.error("Pathao order error:", error.response?.data);
    if (error.response?.status === 401) {
      cachedToken = null;
      tokenExpiry = 0;
    }
    throw new ApiError(
      400,
      error.response?.data?.message || error.message || "Pathao Order Failed!",
    );
  }
};

// ================================================================
// Pathao Bulk Send — Loop করে একটা একটা single order API call
// ================================================================
export const bulkSendToPathaoService = async (
  order_ids: string[],
): Promise<{ success: any[]; failed: any[] }> => {
  const successList: any[] = [];
  const failedList: any[] = [];

  const orders = await OrderModel.find({
    _id: { $in: order_ids },
  }).populate("customer_id");

  const validOrders: any[] = [];

  for (const order of orders) {
    const o = order as any;
    if (o.courier_type === "pathao" && o.consignment_id) {
      failedList.push({
        order_id: o._id,
        invoice_id: o.invoice_id,
        reason: "আগেই Pathao তে পাঠানো হয়েছে",
      });
      continue;
    }
    if (["processing", "shipped", "delivered"].includes(o.order_status)) {
      failedList.push({
        order_id: o._id,
        invoice_id: o.invoice_id,
        reason: `Status "${o.order_status}" — পাঠানো যাবে না`,
      });
      continue;
    }
    if (!o.pathao_city_id || !o.pathao_zone_id) {
      failedList.push({
        order_id: o._id,
        invoice_id: o.invoice_id,
        reason: "Pathao city/zone সেট করা নেই",
      });
      continue;
    }
    validOrders.push(o);
  }

  if (validOrders.length === 0)
    return { success: successList, failed: failedList };

  const cfg = await getPathaoConfig();
  const accessToken = await getPathaoAccessToken(cfg);
  const storeId = Number(cfg.store_id);
  const timeNow =
    new Date().toISOString().split("T")[0] +
    " " +
    new Date().toLocaleTimeString();

  for (const o of validOrders) {
    try {
      // ── Delivery override ───────────────────────────────────────────────────

      const recipientName =
        o.delivery_name || (o.customer_id as any)?.user_name || "Customer";
      const recipientPhone = o.delivery_phone || o.customer_phone;
      const recipientAddress = o.delivery_address || o.billing_address;
      const specialNote = o.delivery_note
        ? `${o.delivery_note} | Invoice: ${o.invoice_id}`
        : `Invoice: ${o.invoice_id}`;
      const altPhone = o.delivery_alt_phone || "";

      // ── Compute item_weight (kg) + item_quantity from line items ─────────────
      // Mirror single-send: sum variation_weight_grams (500g fallback per unit),
      // floor at 0.5kg. Previously this bulk path hardcoded 0.5kg/qty:1, so bulk
      // orders were billed the wrong courier weight.
      const oProducts = await OrderProductModel.find({ order_id: o._id })
        .populate({ path: "variation_id", select: "variation_weight_grams" })
        .lean();
      let totalGrams = 0;
      let totalQty = 0;
      for (const op of oProducts) {
        const qty = op.product_quantity || 1;
        totalQty += qty;
        const grams = (op.variation_id as any)?.variation_weight_grams;
        totalGrams += (typeof grams === "number" && grams > 0 ? grams : 500) * qty;
      }
      const item_weight = Math.max(0.5, totalGrams / 1000);
      const item_quantity = Math.max(1, totalQty);

      const payload = {
        store_id: storeId,
        merchant_order_id: o.invoice_id,
        recipient_name: recipientName,
        recipient_phone: normalizePhone(recipientPhone),
        recipient_secondary_phone: (altPhone && normalizePhone(altPhone)) || "",
        recipient_address: recipientAddress,
        recipient_city: o.pathao_city_id,
        recipient_zone: o.pathao_zone_id,
        delivery_type: 48,
        item_type: 2,
        special_instruction: specialNote,
        item_quantity,
        item_weight,
        amount_to_collect: o.grand_total_amount,
        item_description: `Order ${o.invoice_id}`,
      };

      const response = await axios.post(`${cfg.base_url}/orders`, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (response.data?.code !== 200) {
        const errMsg =
          response.data?.message?.error_list?.join(", ") ||
          response.data?.message ||
          "Pathao Order Failed!";
        failedList.push({
          order_id: o._id,
          invoice_id: o.invoice_id,
          reason: errMsg,
        });
        continue;
      }

      const consignment = response.data?.data;
      if (!consignment?.consignment_id) {
        failedList.push({
          order_id: o._id,
          invoice_id: o.invoice_id,
          reason: "Consignment ID পাওয়া যায়নি",
        });
        continue;
      }

      await OrderModel.updateOne(
        { _id: o._id },
        {
          consignment_id: consignment.consignment_id,
          tracking_code: consignment.order_tracking_code,
          courier_type: "pathao",
          order_status: "processing",
          processing_time: timeNow,
          pathao_status: "Pending",
        },
      );

      successList.push({
        order_id: o._id,
        invoice_id: o.invoice_id,
        consignment_id: consignment.consignment_id,
      });
    } catch (err: any) {
      console.error(
        `Pathao single send error for ${o.invoice_id}:`,
        err.response?.data,
      );
      if (err.response?.status === 401) {
        cachedToken = null;
        tokenExpiry = 0;
      }
      failedList.push({
        order_id: o._id,
        invoice_id: o.invoice_id,
        reason: err.response?.data?.message || err.message || "Failed",
      });
    }
  }

  return { success: successList, failed: failedList };
};

// ================================================================
// Pathao status sync
// ================================================================
export const syncPathaoOrderService = async (
  order_id: string,
): Promise<any> => {
  const order: any = await OrderModel.findById(order_id);
  if (!order) throw new ApiError(404, "Order Not Found!");

  if (order.courier_type !== "pathao")
    throw new ApiError(400, "এই order Pathao courier এর না।");

  if (!order.consignment_id)
    throw new ApiError(
      400,
      "Consignment ID পাওয়া যায়নি। Pathao bulk send async — ১-২ মিনিট অপেক্ষা করুন তারপর আবার Sync করুন।",
    );

  const cfg = await getPathaoConfig();
  const accessToken = await getPathaoAccessToken(cfg);

  try {
    const response = await axios.get(
      `${cfg.base_url}/orders/${order.consignment_id}/info`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      },
    );

    const pathaoStatus = response.data?.data?.order_status;
    if (!pathaoStatus)
      throw new ApiError(400, "Pathao থেকে status পাওয়া যায়নি।");

    const newOrderStatus = pathaoStatusMap[pathaoStatus];
    const timeNow =
      new Date().toISOString().split("T")[0] +
      " " +
      new Date().toLocaleTimeString();

    const updateData: any = { pathao_status: pathaoStatus };

    if (newOrderStatus) {
      updateData.order_status = newOrderStatus;
      if (newOrderStatus === "processing" && !order.processing_time)
        updateData.processing_time = timeNow;
      if (newOrderStatus === "shipped" && !order.shipped_time)
        updateData.shipped_time = timeNow;
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

    await OrderModel.updateOne({ _id: order_id }, { $set: updateData });

    // Restock on cancel/return (idempotent via order.stock_restored).
    if (newOrderStatus === "cancel" || newOrderStatus === "return") {
      await restockOrder(order_id);
    }

    return { pathao_status: pathaoStatus, order_status: newOrderStatus };
  } catch (error: any) {
    if (error.response?.status === 401) {
      cachedToken = null;
      tokenExpiry = 0;
    }
    throw new ApiError(
      400,
      error.response?.data?.message || "Pathao Sync Failed!",
    );
  }
};

// ================================================================
// Pathao Bulk Sync
// ================================================================
export const bulkSyncPathaoOrdersService = async (): Promise<{
  success: any[];
  failed: any[];
  skipped: any[];
}> => {
  const successList: any[] = [];
  const failedList: any[] = [];
  const skippedList: any[] = [];

  const orders = await OrderModel.find({
    courier_type: "pathao",
    order_status: { $nin: ["delivered", "return", "cancel"] },
  });

  const cfg = await getPathaoConfig();
  const accessToken = await getPathaoAccessToken(cfg);
  const timeNow =
    new Date().toISOString().split("T")[0] +
    " " +
    new Date().toLocaleTimeString();

  for (const order of orders) {
    const o = order as any;

    if (!o.consignment_id) {
      skippedList.push({
        order_id: o._id,
        invoice_id: o.invoice_id,
        reason: "Consignment ID নেই",
      });
      continue;
    }

    try {
      const response = await axios.get(
        `${cfg.base_url}/orders/${o.consignment_id}/info`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        },
      );

      const pathaoStatus = response.data?.data?.order_status;
      if (!pathaoStatus) {
        failedList.push({
          order_id: o._id,
          invoice_id: o.invoice_id,
          reason: "Pathao থেকে status পাওয়া যায়নি",
        });
        continue;
      }

      const newOrderStatus = pathaoStatusMap[pathaoStatus];
      const updateData: any = { pathao_status: pathaoStatus };

      if (newOrderStatus) {
        updateData.order_status = newOrderStatus;
        if (newOrderStatus === "shipped" && !o.shipped_time)
          updateData.shipped_time = timeNow;
        if (newOrderStatus === "cancel" && !o.cancel_time)
          updateData.cancel_time = timeNow;
        if (newOrderStatus === "return" && !o.return_time)
          updateData.return_time = timeNow;
        if (newOrderStatus === "delivered" && o.order_status !== "delivered") {
          updateData.delivered_time = timeNow;
          // Stock already decremented at placement (B2) — no decrement here.
        }
      }

      await OrderModel.updateOne({ _id: o._id }, { $set: updateData });

      // Restock on cancel/return (idempotent via order.stock_restored).
      if (newOrderStatus === "cancel" || newOrderStatus === "return") {
        await restockOrder(o._id);
      }

      successList.push({
        order_id: o._id,
        invoice_id: o.invoice_id,
        pathao_status: pathaoStatus,
        order_status: newOrderStatus,
      });
    } catch (err: any) {
      failedList.push({
        order_id: o._id,
        invoice_id: o.invoice_id,
        reason: err.message || "Sync failed",
      });
    }
  }

  return { success: successList, failed: failedList, skipped: skippedList };
};

// ================================================================
// Pathao Order Cancel
// ================================================================
export const cancelPathaoOrderService = async (
  order_id: string,
): Promise<any> => {
  const order: any = await OrderModel.findById(order_id);
  if (!order) throw new ApiError(404, "Order Not Found!");

  if (order.courier_type !== "pathao")
    throw new ApiError(400, "এই order Pathao courier এর না।");

  if (!order.consignment_id)
    throw new ApiError(400, "Consignment ID নেই — Pathao তে পাঠানো হয়নি।");

  if (order.pathao_status && order.pathao_status !== "Pending") {
    throw new ApiError(
      400,
      `Pathao status "${order.pathao_status}" — API দিয়ে cancel করা যাবে না। Pathao portal থেকে manually cancel করুন।`,
    );
  }

  const cfg = await getPathaoConfig();
  const accessToken = await getPathaoAccessToken(cfg);

  try {
    const response = await axios.put(
      `${cfg.base_url}/orders/${order.consignment_id}/cancel`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
    );

    console.log("Pathao cancel response:", response.data);

    const timeNow =
      new Date().toISOString().split("T")[0] +
      " " +
      new Date().toLocaleTimeString();

    await OrderModel.updateOne(
      { _id: order_id },
      {
        $set: {
          order_status: "cancel",
          pathao_status: "Pickup Cancel",
          cancel_time: timeNow,
        },
      },
    );

    return { message: "Pathao তে Order Cancel সফল!" };
  } catch (error: any) {
    console.error("Pathao cancel error:", error.response?.data);
    if (error.response?.status === 401) {
      cachedToken = null;
      tokenExpiry = 0;
    }
    const errMsg =
      error.response?.data?.message || error.message || "Pathao Cancel Failed!";
    throw new ApiError(400, errMsg);
  }
};

// ================================================================
// Pathao tracking
// ================================================================
export const trackPathaoOrderService = async (
  consignment_id: string,
): Promise<any> => {
  const cfg = await getPathaoConfig();
  const accessToken = await getPathaoAccessToken(cfg);
  try {
    const response = await axios.get(
      `${cfg.base_url}/orders/${consignment_id}/info`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      },
    );
    return response.data;
  } catch (error: any) {
    console.error("Pathao tracking error:", error.response?.data);
    throw new ApiError(
      400,
      error.response?.data?.message || "Pathao Tracking Failed!",
    );
  }
};
