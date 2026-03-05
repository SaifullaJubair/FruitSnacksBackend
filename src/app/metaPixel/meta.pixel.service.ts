import axios from "axios";
import crypto from "crypto";
import { MetaEventData } from "./meta.pixel.interface";
import SettingModel from "../setting/setting.model";

const API_VERSION = "v18.0";

const hashData = (data: string): string => {
  if (!data) return "";
  return crypto.createHash("sha256").update(data.trim().toLowerCase()).digest("hex");
};

const normalizePhone = (phone: string): string => {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
};

export const sendMetaEvent = async (data: MetaEventData) => {
  // ✅ DB থেকে শুধু enabled check
  const setting = await SettingModel.findOne({}).lean();
  if (!setting?.meta_pixel_enabled) return;
  if (!setting?.meta_capi_enabled) return;

  // ✅ Credentials .env থেকে
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!pixelId || !accessToken) {
    console.warn("Meta CAPI: META_PIXEL_ID or META_ACCESS_TOKEN not set in .env");
    return;
  }

  const API_URL = `https://graph.facebook.com/${API_VERSION}/${pixelId}/events`;

  try {
    const payload = {
      data: [
        {
          event_name: data.event_name,
          event_time: Math.floor(Date.now() / 1000),
          event_id: data.event_id,
          event_source_url: data.event_source_url || process.env.SITE_URL || "",
          action_source: "website",
          user_data: {
            client_ip_address: data.user_data?.client_ip_address,
            client_user_agent: data.user_data?.client_user_agent,
            ph: data.user_data?.ph ? hashData(normalizePhone(data.user_data.ph)) : undefined,
            em: data.user_data?.em ? hashData(data.user_data.em) : undefined,
            fn: data.user_data?.fn ? hashData(data.user_data.fn) : undefined,
            external_id: data.user_data?.external_id ? hashData(data.user_data.external_id) : undefined,
            fbc: data.user_data?.fbc,
            fbp: data.user_data?.fbp,
          },
          custom_data: data.custom_data,
        },
      ],
      test_event_code: process.env.META_TEST_EVENT_CODE || undefined,
    };

    const response = await axios.post(`${API_URL}?access_token=${accessToken}`, payload);
    return response.data;
  } catch (error: any) {
    console.error("Meta CAPI error:", error?.response?.data || error.message);
  }
};