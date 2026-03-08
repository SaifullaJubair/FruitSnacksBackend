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
  const setting = await SettingModel.findOne({}).lean();
  if (!setting?.tiktok_pixel_enabled) return;
  if (!setting?.tiktok_capi_enabled) return;

  const pixelId = process.env.TIKTOK_PIXEL_ID?.trim();
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN?.trim();

  if (!pixelId || !accessToken) {
    console.warn(
      "TikTok Events API: TIKTOK_PIXEL_ID or TIKTOK_ACCESS_TOKEN not set in .env",
    );
    return;
  }

  try {
    const payload = {
      event_source: "web",
      event_source_id: pixelId,
      data: [
        {
          event: data.event_name,
          event_time: Math.floor(Date.now() / 1000),
          event_id: data.event_id,
          event_source_url: data.event_source_url || process.env.SITE_URL || "",
          user: {
            ip: data.user_data?.client_ip_address || undefined,
            user_agent: data.user_data?.client_user_agent || undefined,
            ...(data.user_data?.phone && {
              phone: hashData(normalizePhone(data.user_data.phone)),
            }),
            ...(data.user_data?.email && {
              email: hashData(data.user_data.email),
            }),
            ...(data.user_data?.external_id && {
              external_id: hashData(data.user_data.external_id),
            }),
          },
          properties: data.properties || {},
          // test event code থাকলে
          ...(process.env.TIKTOK_TEST_EVENT_CODE && {
            test_event_code: process.env.TIKTOK_TEST_EVENT_CODE,
          }),
        },
      ],
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
