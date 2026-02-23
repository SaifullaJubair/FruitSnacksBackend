import axios from "axios";
import mongoose from "mongoose";
import ApiError from "../../errors/ApiError";
import OrderModel from "../order/order.model";
import OrderProductModel from "../orderProducts/orderProduct.model";
import ProductModel from "../product/product.model";
import VariationModel from "../variation/variation.model";

const PATHAO_BASE_URL =
  process.env.PATHAO_BASE_URL || "https://api-hermes.pathao.com/aladdin/api/v1";
const PATHAO_CLIENT_ID = process.env.PATHAO_CLIENT_ID!;
const PATHAO_CLIENT_SECRET = process.env.PATHAO_CLIENT_SECRET!;
const PATHAO_CLIENT_EMAIL = process.env.PATHAO_CLIENT_EMAIL!;
const PATHAO_CLIENT_PASSWORD = process.env.PATHAO_CLIENT_PASSWORD!;

// ================================================================
// Token Cache — প্রতি request এ নতুন token নেওয়া দরকার নেই
// ================================================================
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

const getPathaoAccessToken = async (): Promise<string> => {
  const now = Date.now();

  // token valid থাকলে reuse করো (5 min buffer রাখো)
  if (cachedToken && now < tokenExpiry - 5 * 60 * 1000) {
    return cachedToken;
  }

  try {
    const response = await axios.post(`${PATHAO_BASE_URL}/issue-token`, {
      client_id: PATHAO_CLIENT_ID,
      client_secret: PATHAO_CLIENT_SECRET,
      username: PATHAO_CLIENT_EMAIL,
      password: PATHAO_CLIENT_PASSWORD,
      grant_type: "password",
    });

    if (!response.data?.access_token) {
      throw new ApiError(400, "Pathao Token নেওয়া ব্যর্থ হয়েছে!");
    }

    cachedToken = response.data.access_token;
    // expires_in সাধারণত seconds এ আসে
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
  // Processing statuses
  Pending: "processing",
  "Order Created": "processing",
  "Order Updated": "processing",
  "Pickup Requested": "processing",
  "Pickup Scheduled": "processing",
  "Assigned For Pickup": "processing",
  "Pickup Failed": "processing",
  "Pickup Cancel": "cancel", // ✅ Pathao portal থেকে cancel
  "Pickup Cancelled": "cancel", // ✅ alternate spelling
  Exchange: "processing",
  // Shipped statuses
  Pickup: "shipped",
  "Picked Up": "shipped",
  "At the Sorting Hub": "shipped",
  "In Transit": "shipped",
  "Received at Last Mile Hub": "shipped",
  "Assigned for Delivery": "shipped",
  "Out for Delivery": "shipped",
  "On Hold": "shipped",
  Hold: "shipped",
  // Delivered statuses
  Delivered: "delivered",
  "Partial Delivery": "delivered",
  "Partially Delivered": "delivered",
  // Return statuses
  Return: "return",
  Returned: "return",
  "Paid Return": "return",
  "Partially Returned": "return",
  "Delivery Failed": "cancel",
  // Cancelled
  Cancelled: "cancel",
  "Delivery Cancelled": "cancel",
};

// ================================================================
// Pathao এ order পাঠাও
// ================================================================
export const sendOrderToPathaoService = async (
  order_id: string,
  session: mongoose.ClientSession,
): Promise<any> => {
  const order: any =
    await OrderModel.findById(order_id).populate("customer_id");
  if (!order) throw new ApiError(404, "Order Not Found!");

  // ✅ Duplicate check
  if (order.courier_type === "pathao" && order.consignment_id) {
    throw new ApiError(
      400,
      `এই order আগেই Pathao তে পাঠানো হয়েছে। Consignment ID: ${order.consignment_id}`,
    );
  }

  // ✅ Already processing/shipped/delivered হলে block
  if (["processing", "shipped", "delivered"].includes(order.order_status)) {
    throw new ApiError(
      400,
      `এই order ইতিমধ্যে "${order.order_status}" status এ আছে।`,
    );
  }

  // ✅ Pathao city/zone check
  if (!order.pathao_city_id || !order.pathao_zone_id) {
    throw new ApiError(
      400,
      "এই order এ Pathao city/zone সেট করা নেই। Order details চেক করুন।",
    );
  }

  const accessToken = await getPathaoAccessToken();

  const payload = {
    store_id: process.env.PATHAO_STORE_ID,
    merchant_order_id: order.invoice_id,
    recipient_name: order.customer_id?.user_name || "Customer",
    recipient_phone: order.customer_phone,
    recipient_address: order.billing_address,
    recipient_city: order.pathao_city_id,
    recipient_zone: order.pathao_zone_id,
    delivery_type: 48,
    item_type: 2,
    special_instruction: `Invoice: ${order.invoice_id}`,
    item_quantity: 1,
    item_weight: 0.5,
    amount_to_collect: order.grand_total_amount,
    item_description: `Order ${order.invoice_id}`,
  };

  console.log("Pathao payload:", payload);

  try {
    const response = await axios.post(`${PATHAO_BASE_URL}/orders`, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    console.log("Pathao response:", response.data);

    if (response.data?.code !== 200) {
      const errMsg =
        response.data?.message?.error_list?.join(", ") ||
        response.data?.message ||
        "Pathao Order Failed!";
      throw new ApiError(400, errMsg);
    }

    const consignment = response.data?.data;

    // ✅ Consignment না আসলে edge case
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
      },
      { session, runValidators: true },
    );

    return consignment;
  } catch (error: any) {
    console.error("Pathao order error:", error.response?.data);
    // token invalid হলে cache clear করো
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
// Pathao tracking
// ================================================================
export const trackPathaoOrderService = async (
  consignment_id: string,
): Promise<any> => {
  const accessToken = await getPathaoAccessToken();

  try {
    const response = await axios.get(
      `${PATHAO_BASE_URL}/orders/${consignment_id}/info`,
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

// ================================================================
// Pathao status sync — DB তে manually update করো
// ================================================================
export const syncPathaoOrderService = async (
  order_id: string,
): Promise<any> => {
  const order: any = await OrderModel.findById(order_id);
  if (!order) throw new ApiError(404, "Order Not Found!");

  if (order.courier_type !== "pathao") {
    throw new ApiError(400, "এই order Pathao courier এর না।");
  }

  const accessToken = await getPathaoAccessToken();

  // ── consignment_id নেই মানে bulk send হয়েছে, Pathao async তাই এখনো আসেনি ──
  // Solution: merchant_order_id (invoice_id) দিয়ে Pathao তে খুঁজবো
  // Pathao Get Order Short Info: /orders/{consignment_id}/info — consignment_id লাগে
  // কিন্তু আমরা merchant_order_id জানি, Pathao এ এটা দিয়ে search করার endpoint নেই
  // তাই আমাদের single order create করে consignment_id পেতে হবে
  // অথবা user কে বলতে হবে portal থেকে consignment_id দেখে আসতে

  if (!order.consignment_id) {
    throw new ApiError(
      400,
      "Consignment ID পাওয়া যায়নি। Pathao bulk send async — ১-২ মিনিট অপেক্ষা করুন তারপর আবার Sync করুন।",
    );
  }

  try {
    const response = await axios.get(
      `${PATHAO_BASE_URL}/orders/${order.consignment_id}/info`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      },
    );

    const pathaoStatus = response.data?.data?.order_status;
    if (!pathaoStatus) {
      throw new ApiError(400, "Pathao থেকে status পাওয়া যায়নি।");
    }

    const newOrderStatus = pathaoStatusMap[pathaoStatus];
    const timeNow =
      new Date().toISOString().split("T")[0] +
      " " +
      new Date().toLocaleTimeString();

    const updateData: any = {
      pathao_status: pathaoStatus,
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

        // quantity কমাও
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

    await OrderModel.updateOne({ _id: order_id }, { $set: updateData });

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
// Pathao Bulk Send —  Loop করে একটা একটা single order API call করে  একসাথে multiple order পাঠাও
// ================================================================
export const bulkSendToPathaoService = async (
  order_ids: string[],
): Promise<{ success: any[]; failed: any[] }> => {
  const successList: any[] = [];
  const failedList: any[] = [];

  // সব order fetch করো
  const orders = await OrderModel.find({
    _id: { $in: order_ids },
  }).populate("customer_id");

  // ── Validation — কোনটা পাঠানো যাবে না ──────────────────────
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

  if (validOrders.length === 0) {
    return { success: successList, failed: failedList };
  }

  // ── Token একবার নাও ──────────────────────────────────────────
  const accessToken = await getPathaoAccessToken();
  const storeId = Number(process.env.PATHAO_STORE_ID);

  const timeNow =
    new Date().toISOString().split("T")[0] +
    " " +
    new Date().toLocaleTimeString();

  // ── Loop করে একটা একটা single order API call ─────────────────
  // Bulk API বাদ — কারণ bulk async তাই consignment_id সাথে সাথে আসে না
  // Single API তে প্রতিটা response এ সাথে সাথে consignment_id পাওয়া যায়
  for (const o of validOrders) {
    try {
      const payload = {
        store_id: storeId,
        merchant_order_id: o.invoice_id,
        recipient_name: (o.customer_id as any)?.user_name || "Customer",
        recipient_phone: o.customer_phone,
        recipient_address: o.billing_address,
        recipient_city: o.pathao_city_id,
        recipient_zone: o.pathao_zone_id,
        delivery_type: 48,
        item_type: 2,
        special_instruction: `Invoice: ${o.invoice_id}`,
        item_quantity: 1,
        item_weight: 0.5,
        amount_to_collect: o.grand_total_amount,
        item_description: `Order ${o.invoice_id}`,
      };

      const response = await axios.post(`${PATHAO_BASE_URL}/orders`, payload, {
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

      // ✅ সাথে সাথে consignment_id save করো
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
// Pathao Bulk Sync — সব consignment_id আছে এমন order sync করো
// ================================================================
export const bulkSyncPathaoOrdersService = async (): Promise<{
  success: any[];
  failed: any[];
  skipped: any[];
}> => {
  const successList: any[] = [];
  const failedList: any[] = [];
  const skippedList: any[] = [];

  // সব Pathao order আনো যেগুলো delivered/return/cancel না
  const orders = await OrderModel.find({
    courier_type: "pathao",
    order_status: { $nin: ["delivered", "return", "cancel"] },
  });

  const accessToken = await getPathaoAccessToken();
  const timeNow =
    new Date().toISOString().split("T")[0] +
    " " +
    new Date().toLocaleTimeString();

  for (const order of orders) {
    const o = order as any;

    // consignment_id নেই → skip
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
        `${PATHAO_BASE_URL}/orders/${o.consignment_id}/info`,
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
          // inventory কমাও
          const orderProducts = await OrderProductModel.find({
            order_id: o._id.toString(),
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
      }

      await OrderModel.updateOne({ _id: o._id }, { $set: updateData });
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
// শুধু "Pending" status এ API দিয়ে cancel করা যাবে
// অন্য status এ error দেবে — portal থেকে manually করতে হবে
// ================================================================

export const cancelPathaoOrderService = async (
  order_id: string,
): Promise<any> => {
  const order: any = await OrderModel.findById(order_id);
  if (!order) throw new ApiError(404, "Order Not Found!");

  if (order.courier_type !== "pathao") {
    throw new ApiError(400, "এই order Pathao courier এর না।");
  }

  if (!order.consignment_id) {
    throw new ApiError(400, "Consignment ID নেই — Pathao তে পাঠানো হয়নি।");
  }

  // Pending ছাড়া cancel করা যাবে না
  if (order.pathao_status && order.pathao_status !== "Pending") {
    throw new ApiError(
      400,
      `Pathao status "${order.pathao_status}" — API দিয়ে cancel করা যাবে না। Pathao portal থেকে manually cancel করুন।`,
    );
  }

  const accessToken = await getPathaoAccessToken();

  try {
    const response = await axios.put(
      `${PATHAO_BASE_URL}/orders/${order.consignment_id}/cancel`,
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

    // Cancel সফল হলে DB update করো
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

    // Pathao থেকে specific error আসলে সেটা দেখাও
    const errMsg =
      error.response?.data?.message || error.message || "Pathao Cancel Failed!";
    throw new ApiError(400, errMsg);
  }
};

// ================================================================
// Pathao Bulk Send- with builk api — একসাথে multiple order পাঠাও
// ================================================================
// export const bulkSendToPathaoService = async (
//   order_ids: string[],
// ): Promise<{ success: any[]; failed: any[] }> => {
//   const successList: any[] = [];
//   const failedList: any[] = [];

//   // সব order fetch করো
//   const orders = await OrderModel.find({
//     _id: { $in: order_ids },
//   }).populate("customer_id");

//   // ── Validation — কোনটা পাঠানো যাবে না ──────────────────────
//   const validOrders: any[] = [];

//   for (const order of orders) {
//     const o = order as any;

//     if (o.courier_type === "pathao" && o.consignment_id) {
//       failedList.push({
//         order_id: o._id,
//         invoice_id: o.invoice_id,
//         reason: "আগেই Pathao তে পাঠানো হয়েছে",
//       });
//       continue;
//     }
//     if (["processing", "shipped", "delivered"].includes(o.order_status)) {
//       failedList.push({
//         order_id: o._id,
//         invoice_id: o.invoice_id,
//         reason: `Status "${o.order_status}" — পাঠানো যাবে না`,
//       });
//       continue;
//     }
//     if (!o.pathao_city_id || !o.pathao_zone_id) {
//       failedList.push({
//         order_id: o._id,
//         invoice_id: o.invoice_id,
//         reason: "Pathao city/zone সেট করা নেই",
//       });
//       continue;
//     }
//     validOrders.push(o);
//   }

//   if (validOrders.length === 0) {
//     return { success: successList, failed: failedList };
//   }

//   // ── Token একবার নাও ──────────────────────────────────────────
//   const accessToken = await getPathaoAccessToken();
//   const storeId = Number(process.env.PATHAO_STORE_ID);

//   // ── Pathao bulk payload বানাও ────────────────────────────────
//   const bulkPayload = {
//     orders: validOrders.map((o) => ({
//       store_id: storeId,
//       merchant_order_id: o.invoice_id,
//       recipient_name: (o.customer_id as any)?.user_name || "Customer",
//       recipient_phone: o.customer_phone,
//       recipient_address: o.billing_address,
//       recipient_city: o.pathao_city_id,
//       recipient_zone: o.pathao_zone_id,
//       delivery_type: 48,
//       item_type: 2,
//       special_instruction: `Invoice: ${o.invoice_id}`,
//       item_quantity: 1,
//       item_weight: 0.5,
//       amount_to_collect: o.grand_total_amount,
//       item_description: `Order ${o.invoice_id}`,
//     })),
//   };

//   console.log("Pathao bulk payload:", JSON.stringify(bulkPayload));

//   try {
//     // ── Pathao bulk API call ─────────────────────────────────────
//     // Pathao bulk response: 202 — async processing
//     // তাই আমরা DB তে "processing" set করব, পরে sync দিয়ে consignment_id আনব
//     const response = await axios.post(
//       `${PATHAO_BASE_URL}/orders/bulk`,
//       bulkPayload,
//       {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//           "Content-Type": "application/json; charset=UTF-8",
//           Accept: "application/json",
//         },
//       },
//     );

//     console.log("Pathao bulk response:", response.data);

//     // Pathao bulk API 202 দেয় — মানে accepted, async process হবে
//     // সব valid order কে processing এ set করো
//     const timeNow =
//       new Date().toISOString().split("T")[0] +
//       " " +
//       new Date().toLocaleTimeString();

//     for (const o of validOrders) {
//       await OrderModel.updateOne(
//         { _id: o._id },
//         {
//           courier_type: "pathao",
//           order_status: "processing",
//           processing_time: timeNow,
//           pathao_status: "Pending",
//         },
//       );
//       successList.push({ order_id: o._id, invoice_id: o.invoice_id });
//     }

//     return { success: successList, failed: failedList };
//   } catch (error: any) {
//     console.error("Pathao bulk error:", error.response?.data);

//     if (error.response?.status === 401) {
//       cachedToken = null;
//       tokenExpiry = 0;
//     }

//     // bulk fail হলে সব valid order কে failed এ দাও
//     for (const o of validOrders) {
//       failedList.push({
//         order_id: o._id,
//         invoice_id: o.invoice_id,
//         reason: error.response?.data?.message || "Pathao Bulk Send Failed!",
//       });
//     }

//     return { success: successList, failed: failedList };
//   }
// };