import axios from "axios";
import mongoose from "mongoose";
import ApiError from "../../errors/ApiError";
import OrderModel from "./order.model";

const PATHAO_BASE_URL =
  process.env.PATHAO_BASE_URL || "https://merchant.pathao.com/api/v1";
const PATHAO_CLIENT_ID = process.env.PATHAO_CLIENT_ID!;
const PATHAO_CLIENT_SECRET = process.env.PATHAO_CLIENT_SECRET!;
const PATHAO_CLIENT_EMAIL = process.env.PATHAO_CLIENT_EMAIL!;
const PATHAO_CLIENT_PASSWORD = process.env.PATHAO_CLIENT_PASSWORD!;

// Pathao access token নেওয়া
const getPathaoAccessToken = async (): Promise<string> => {
  const response = await axios
    .post(`${PATHAO_BASE_URL}/issue-token`, {
      client_id: PATHAO_CLIENT_ID,
      client_secret: PATHAO_CLIENT_SECRET,
      username: PATHAO_CLIENT_EMAIL,
      password: PATHAO_CLIENT_PASSWORD,
      grant_type: "password",
    })
    .catch((error) => {
      console.log("Pathao token error:", error.response?.data); // এটা add করুন
      throw error;
    });

  if (!response.data?.access_token) {
    throw new ApiError(400, "Pathao Token নেওয়া ব্যর্থ হয়েছে!");
  }

  return response.data.access_token;
};

// Pathao এ order পাঠানো
export const sendOrderToPathaoService = async (
  order_id: string,
  session: mongoose.ClientSession,
): Promise<any> => {
  const order: any =
    await OrderModel.findById(order_id).populate("customer_id");
  if (!order) throw new ApiError(404, "Order Not Found!");

  if (order.consignment_id) {
    throw new ApiError(400, "এই order আগেই Pathao তে পাঠানো হয়েছে!");
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
    delivery_type: 48, // 48 hour delivery
    item_type: 2, // parcel
    special_instruction: `Invoice: ${order.invoice_id}`,
    item_quantity: 1,
    item_weight: 0.5,
    amount_to_collect: order.grand_total_amount,
    item_description: `Order ${order.invoice_id}`,
  };
  console.log(payload, "Payload");

  const response = await axios
    .post(`${PATHAO_BASE_URL}/orders`, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    })
    .catch((error) => {
      // এটা add করুন
      console.log("Pathao error details:", error.response?.data);
      throw error;
    });

  if (response.data?.code !== 200) {
    throw new ApiError(
      400,
      response.data?.message?.error_list?.join(", ") || "Pathao Order Failed!",
    );
  }

  console.log("Pathao response:", response);
  const consignment = response.data?.data;

  // Order update করো pathao info দিয়ে
  await OrderModel.updateOne(
    { _id: order_id },
    {
      consignment_id: consignment?.consignment_id,
      tracking_code: consignment?.order_tracking_code,
      courier_type: "pathao",
      order_status: "processing", // ✅ এটা যোগ করো
      processing_time:
        new Date().toISOString().split("T")[0] +
        " " +
        new Date().toLocaleTimeString(), // ✅ এটা যোগ করো
    },
    { session, runValidators: true },
  );

  return consignment;
};

// Pathao tracking
