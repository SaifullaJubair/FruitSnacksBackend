import axios from "axios";
import crypto from "crypto";
import { ITikTokEventData } from "./tiktok.pixel.interface";
import SettingModel from "../setting/setting.model";

const API_URL = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

const hashData = (data: string): string => {
  if (!data) return "";
  return crypto
    .createHash("sha256")
    .update(data.trim().toLowerCase())
    .digest("hex");
};

const normalizePhone = (phone: string): string => {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
};

export const sendTikTokEvent = async (data: ITikTokEventData) => {
  // ✅ DB থেকে শুধু enabled check
  const setting = await SettingModel.findOne({}).lean();
  if (!setting?.tiktok_pixel_enabled) return;
  if (!setting?.tiktok_capi_enabled) return;

  // ✅ Credentials .env থেকে
  const pixelId = process.env.TIKTOK_PIXEL_ID;
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  if (!pixelId || !accessToken) {
    console.warn(
      "TikTok Events API: TIKTOK_PIXEL_ID or TIKTOK_ACCESS_TOKEN not set in .env",
    );
    return;
  }

  try {
    const payload = {
      pixel_code: pixelId,
      test_event_code: process.env.TIKTOK_TEST_EVENT_CODE || undefined,
      event: data.event_name,
      event_time: Math.floor(Date.now() / 1000),
      event_id: data.event_id,
      event_source: "web",
      event_source_url: data.event_source_url || process.env.SITE_URL || "",
      user: {
        ip: data.user_data?.client_ip_address,
        user_agent: data.user_data?.client_user_agent,
        phone: data.user_data?.phone
          ? hashData(normalizePhone(data.user_data.phone))
          : undefined,
        email: data.user_data?.email
          ? hashData(data.user_data.email)
          : undefined,
        external_id: data.user_data?.external_id
          ? hashData(data.user_data.external_id)
          : undefined,
      },
      properties: data.properties || {},
    };

    const response = await axios.post(API_URL, payload, {
      headers: {
        "Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error: any) {
    console.error(
      "TikTok Events API error:",
      error?.response?.data || error.message,
    );
  }
};
