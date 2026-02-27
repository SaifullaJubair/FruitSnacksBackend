import axios from "axios";
import crypto from "crypto";
require("dotenv").config();

const PIXEL_ID = process.env.META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const API_URL = `https://graph.facebook.com/v18.0/${PIXEL_ID}/events`;

// Phone/Email hash করো — Meta requirement
const hashData = (data: string): string => {
  if (!data) return "";
  return crypto
    .createHash("sha256")
    .update(data.trim().toLowerCase())
    .digest("hex");
};

// Phone normalize করো — +880 সরিয়ে শুধু number
const normalizePhone = (phone: string): string => {
  if (!phone) return "";
  return phone.replace(/\D/g, ""); // শুধু digits রাখো
};

interface MetaEventData {
  event_name: string;
  event_id: string;
  event_source_url?: string;
  user_data: {
    client_ip_address?: string;
    client_user_agent?: string;
    ph?: string; // phone (hashed)
    em?: string; // email (hashed)
    fn?: string; // first name (hashed)
    external_id?: string; // user_id (hashed)
    fbc?: string; // fb click id cookie
    fbp?: string; // fb browser id cookie
  };
  custom_data?: {
    currency?: string;
    value?: number;
    content_ids?: string[];
    content_type?: string;
    content_name?: string;
    num_items?: number;
    order_id?: string;
  };
  action_source: "website";
}

export const sendMetaEvent = async (data: MetaEventData) => {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.warn("Meta Pixel credentials missing");
    return;
  }

  try {
    const payload = {
      data: [
        {
          event_name: data.event_name,
          event_time: Math.floor(Date.now() / 1000),
          event_id: data.event_id,
          event_source_url:
            data.event_source_url || "https://artisenleather.com",
          action_source: "website",
          user_data: {
            client_ip_address: data.user_data?.client_ip_address,
            client_user_agent: data.user_data?.client_user_agent,
            ph: data.user_data?.ph
              ? hashData(normalizePhone(data.user_data.ph))
              : undefined,
            em: data.user_data?.em ? hashData(data.user_data.em) : undefined,
            fn: data.user_data?.fn ? hashData(data.user_data.fn) : undefined,
            external_id: data.user_data?.external_id
              ? hashData(data.user_data.external_id)
              : undefined,
            fbc: data.user_data?.fbc,
            fbp: data.user_data?.fbp,
          },
          custom_data: data.custom_data,
        },
      ],
      test_event_code: process.env.META_TEST_EVENT_CODE || undefined,
    };

    const response = await axios.post(
      `${API_URL}?access_token=${ACCESS_TOKEN}`,
      payload,
    );

    return response.data;
  } catch (error: any) {
    console.error("Meta CAPI error:", error?.response?.data || error.message);
  }
};
