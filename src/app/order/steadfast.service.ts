import axios from "axios";
import OrderModel from "../order/order.model";
import ApiError from "../../errors/ApiError";
import mongoose from "mongoose";

// TEST VERSION — hardcoded keys
const STEADFAST_BASE_URL = "https://portal.packzy.com/api/v1";
const STEADFAST_API_KEY = "biu1ehnsukbr8oh5ha0tjwqgsuc1abeu";
const STEADFAST_SECRET_KEY = "o1iwwlrubulkqbsb550ek5pd";

// Steadfast এ order পাঠানো
export const sendOrderToSteadfastService = async (
  order_id: string,
  session: mongoose.ClientSession,
): Promise<any> => {
  const order: any =
    await OrderModel.findById(order_id).populate("customer_id");
  if (!order) throw new ApiError(404, "Order Not Found!");

  const payload = {
    invoice: order.invoice_id,
    recipient_name: order.customer_id?.user_name || "Customer",
    recipient_phone: order.customer_phone,
    recipient_address: `${order.billing_address}, ${order.billing_city}, ${order.billing_state}, ${order.billing_country}`,
    cod_amount: order.grand_total_amount,
    note: "",
  };

  console.log("Steadfast payload:", payload);

  const response = await axios.post(
    `${STEADFAST_BASE_URL}/create_order`,
    payload,
    {
      headers: {
        "Api-Key": STEADFAST_API_KEY,
        "Secret-Key": STEADFAST_SECRET_KEY,
        "Content-Type": "application/json",
      },
    },
  );

  console.log("Steadfast response:", response.data);

  if (response.data?.status !== 200) {
    throw new ApiError(
      400,
      response.data?.message || "Steadfast Order Failed!",
    );
  }

  const consignment = response.data?.consignment;

  await OrderModel.updateOne(
    { _id: order_id },
    {
      steadfast_consignment_id: consignment?.consignment_id,
      steadfast_tracking_code: consignment?.tracking_code,
      steadfast_status: consignment?.status,
      courier_type: "steadfast",
    },
    { session, runValidators: true },
  );

  return consignment;
};

// Steadfast tracking
export const trackSteadfastOrderService = async (
  consignment_id: string,
): Promise<any> => {
  const response = await axios.get(
    `${STEADFAST_BASE_URL}/status_by_cid/${consignment_id}`,
    {
      headers: {
        "Api-Key": STEADFAST_API_KEY,
        "Secret-Key": STEADFAST_SECRET_KEY,
      },
    },
  );
  return response.data;
};

// Steadfast balance check
export const getSteadfastBalanceService = async (): Promise<any> => {
  const response = await axios.get(`${STEADFAST_BASE_URL}/get_balance`, {
    headers: {
      "Api-Key": STEADFAST_API_KEY,
      "Secret-Key": STEADFAST_SECRET_KEY,
    },
  });
  return response.data;
};

// import axios from "axios";
// import mongoose from "mongoose";
// import OrderModel from "./order.model";
// import ApiError from "../../errors/ApiError";

// const STEADFAST_BASE_URL = "https://portal.steadfast.com.bd/public/api/v1";
// const STEADFAST_API_KEY = process.env.STEADFAST_API_KEY!;
// const STEADFAST_SECRET_KEY = process.env.STEADFAST_SECRET_KEY!;

// // Steadfast এ order পাঠানো
// export const sendOrderToSteadfastService = async (
//   order_id: string,
//   session: mongoose.ClientSession,
// ): Promise<any> => {
//   const order: any =
//     await OrderModel.findById(order_id).populate("customer_id");
//   if (!order) throw new ApiError(404, "Order Not Found!");

//   if (order.steadfast_consignment_id) {
//     throw new ApiError(400, "এই order আগেই Steadfast এ পাঠানো হয়েছে!");
//   }

//   const payload = {
//     invoice: order.invoice_id,
//     recipient_name: order.customer_id?.user_name || "Customer",
//     recipient_phone: order.customer_phone,
//     recipient_address: `${order.billing_address}, ${order.billing_city}, ${order.billing_state}, ${order.billing_country}`,
//     cod_amount: order.grand_total_amount,
//     note: `Invoice: ${order.invoice_id}`,
//   };

//   const response = await axios.post(
//     `${STEADFAST_BASE_URL}/create_order`,
//     payload,
//     {
//       headers: {
//         // "Api-Key": STEADFAST_API_KEY,
//         // "Secret-Key": STEADFAST_SECRET_KEY,
//         // "Content-Type": "application/json",
//         "Api-Key": "13nfu8inrh0mzqw2yigimse8wqkwzuuj",
//         "Secret-Key": "xgi86dhwxql3taju5f3kmpui",
//         "Content-Type": "application/json",
//       },
//     },
//   );

//   if (response.data?.status !== 200) {
//     throw new ApiError(
//       400,
//       response.data?.message || "Steadfast Order Failed!",
//     );
//   }

//   const consignment = response.data?.consignment;

//   // Order update করো steadfast info দিয়ে
//   await OrderModel.updateOne(
//     { _id: order_id },
//     {
//       steadfast_consignment_id: consignment?.consignment_id,
//       steadfast_tracking_code: consignment?.tracking_code,
//       steadfast_status: consignment?.status,
//       courier_type: "steadfast",
//     },
//     { session, runValidators: true },
//   );

//   return consignment;
// };

// // Steadfast tracking
// export const trackSteadfastOrderService = async (
//   consignment_id: string,
// ): Promise<any> => {
//   const response = await axios.get(
//     `${STEADFAST_BASE_URL}/status_by_cid/${consignment_id}`,
//     {
//       headers: {
//         "Api-Key": STEADFAST_API_KEY,
//         "Secret-Key": STEADFAST_SECRET_KEY,
//       },
//     },
//   );
//   return response.data;
// };

// // Steadfast balance check
// export const getSteadfastBalanceService = async (): Promise<any> => {
//   const response = await axios.get(`${STEADFAST_BASE_URL}/get_balance`, {
//     headers: {
//       "Api-Key": STEADFAST_API_KEY,
//       "Secret-Key": STEADFAST_SECRET_KEY,
//     },
//   });
//   return response.data;
// };
