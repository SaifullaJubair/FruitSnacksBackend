import axios from "axios";
import crypto from "crypto";
import { ITikTokEventData } from "./tiktok.pixel.interface";
import { getCachedSetting } from "../../helpers/settingCache";
import { enrichFromIp } from "../../helpers/geoipEnrich";
import OrderModel from "../order/order.model";

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

const h = (v?: string) =>
  v && v.trim().length > 0 ? hashData(v) : undefined;

export interface TikTokSendResult {
  ok: boolean;
  skipped?: "disabled" | "dedup" | "no_credentials";
  error?: string;
}

export const sendTikTokEvent = async (
  data: ITikTokEventData,
): Promise<TikTokSendResult> => {
  const setting = await getCachedSetting();
  if (!setting?.tiktok_pixel_enabled || !setting?.tiktok_capi_enabled) {
    return { ok: false, skipped: "disabled" };
  }

  const pixelId = (
    setting?.tiktok_pixel_id || process.env.TIKTOK_PIXEL_ID || ""
  ).trim();
  const accessToken = (
    setting?.tiktok_capi_access_token || process.env.TIKTOK_ACCESS_TOKEN || ""
  ).trim();
  const testEventCode = (
    setting?.tiktok_test_event_code || process.env.TIKTOK_TEST_EVENT_CODE || ""
  ).trim();

  if (!pixelId || !accessToken) {
    console.warn(
      "TikTok Events API: pixel_id or access_token not set (DB Settings or .env)",
    );
    return { ok: false, skipped: "no_credentials" };
  }

  // Phase 1B Purchase dedup mirror. Atomic claim BEFORE the outbound call
  // (see meta.pixel.service.ts for why read-then-write-after races).
  const orderId = data.properties?.order_id;
  if (data.event_name === "CompletePayment" && orderId) {
    const claimed = await OrderModel.findOneAndUpdate(
      { _id: orderId, tiktok_purchase_sent: { $ne: true } },
      { $set: { tiktok_purchase_sent: true } },
    ).lean();
    if (!claimed) {
      return { ok: true, skipped: "dedup" };
    }
  }

  const geo = enrichFromIp(data.user_data?.client_ip_address);

  try {
    const payload = {
      event_source: "web",
      event_source_id: pixelId,
      data: [
        {
          event: data.event_name,
          event_time: Math.floor(Date.now() / 1000),
          event_id: data.event_id,
          event_source_url:
            data.event_source_url || process.env.SITE_URL || "",
          user: {
            ip: data.user_data?.client_ip_address || undefined,
            user_agent: data.user_data?.client_user_agent || undefined,
            phone: data.user_data?.phone
              ? hashData(normalizePhone(data.user_data.phone))
              : undefined,
            email: h(data.user_data?.email),
            first_name: h(data.user_data?.first_name),
            last_name: h(data.user_data?.last_name),
            city: h(data.user_data?.city || geo.ct),
            state: h(data.user_data?.state || geo.st),
            zip_code: h(data.user_data?.zip_code),
            country: h(data.user_data?.country || geo.country),
            external_id: h(data.user_data?.external_id),
            ttclid: data.user_data?.ttclid,
            ttp: data.user_data?.ttp,
          },
          properties: data.properties || {},
          ...(testEventCode && { test_event_code: testEventCode }),
        },
      ],
    };

    const response = await axios.post(API_URL, payload, {
      headers: {
        "Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    // TikTok returns code 0 on success; non-zero = error.
    const code = response.data?.code;
    const ok = code === 0;

    if (!ok) {
      console.warn("TikTok CAPI: non-zero code", response.data);
      // Release the claim — TikTok rejected the event, so a retry
      // shouldn't be dedup-skipped forever.
      if (data.event_name === "CompletePayment" && orderId) {
        await OrderModel.updateOne(
          { _id: orderId },
          { $set: { tiktok_purchase_sent: false } },
        ).catch((e) =>
          console.error("TikTok CAPI: failed to release purchase_sent claim", e),
        );
      }
    }

    return { ok };
  } catch (error: any) {
    const msg = error?.response?.data || error?.message || "unknown";
    console.error("TikTok Events API error:", msg);
    if (data.event_name === "CompletePayment" && orderId) {
      await OrderModel.updateOne(
        { _id: orderId },
        { $set: { tiktok_purchase_sent: false } },
      ).catch((e) =>
        console.error("TikTok CAPI: failed to release purchase_sent claim", e),
      );
    }
    return { ok: false, error: typeof msg === "string" ? msg : JSON.stringify(msg) };
  }
};
