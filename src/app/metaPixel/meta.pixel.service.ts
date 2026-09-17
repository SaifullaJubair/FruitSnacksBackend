import axios from "axios";
import crypto from "crypto";
import { MetaEventData } from "./meta.pixel.interface";
import { getCachedSetting } from "../../helpers/settingCache";
import { enrichFromIp } from "../../helpers/geoipEnrich";
import OrderModel from "../order/order.model";

const API_VERSION = "v18.0";

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

// Hash-or-undefined helper — keeps the user_data object clean (Meta
// ignores undefined fields, complains on empty strings).
const h = (v?: string) =>
  v && v.trim().length > 0 ? hashData(v) : undefined;

export interface CapiSendResult {
  ok: boolean;
  skipped?: "disabled" | "dedup" | "no_credentials";
  events_received?: number;
  error?: string;
}

export const sendMetaEvent = async (
  data: MetaEventData,
): Promise<CapiSendResult> => {
  const setting = await getCachedSetting();
  if (!setting?.meta_pixel_enabled || !setting?.meta_capi_enabled) {
    return { ok: false, skipped: "disabled" };
  }

  const pixelId = setting?.meta_pixel_id || process.env.META_PIXEL_ID;
  const accessToken =
    setting?.meta_capi_access_token || process.env.META_ACCESS_TOKEN;
  const testEventCode =
    setting?.meta_test_event_code || process.env.META_TEST_EVENT_CODE;

  if (!pixelId || !accessToken) {
    console.warn(
      "Meta CAPI: pixel_id or access_token not set (DB Settings or .env)",
    );
    return { ok: false, skipped: "no_credentials" };
  }

  // S4+S5 Phase 1B — server-side Purchase dedup. Browser layer may
  // miss when the user clears storage / shares the success URL; this
  // is the ultimate guarantee. event_id alone isn't enough because
  // Meta dedups on event_id+event_name within ~48h but caches roll.
  //
  // Atomic claim BEFORE the outbound call (not a read-then-write-after
  // check): two near-simultaneous callers for the same order (e.g. the
  // backend's own post-commit call racing a frontend-triggered one) can
  // otherwise both read meta_purchase_sent:false before either writes
  // it, so both fire. findOneAndUpdate with a $ne filter is the atomic
  // compare-and-swap — only one caller can win the claim.
  const orderId = data.custom_data?.order_id;
  if (data.event_name === "Purchase" && orderId) {
    const claimed = await OrderModel.findOneAndUpdate(
      { _id: orderId, meta_purchase_sent: { $ne: true } },
      { $set: { meta_purchase_sent: true } },
    ).lean();
    if (!claimed) {
      return { ok: true, skipped: "dedup" };
    }
  }

  // S4+S5 Phase 1B — fill ct/st/country from IP geo when form data
  // didn't supply them. Form-derived values WIN (passed in by FE),
  // so logged-in/checkout flows that know the real shipping city
  // override whatever the IP says.
  const geo = enrichFromIp(data.user_data?.client_ip_address);

  const API_URL = `https://graph.facebook.com/${API_VERSION}/${pixelId}/events`;

  try {
    const payload: any = {
      data: [
        {
          event_name: data.event_name,
          event_time: Math.floor(Date.now() / 1000),
          event_id: data.event_id,
          event_source_url:
            data.event_source_url || process.env.SITE_URL || "",
          action_source: "website",
          user_data: {
            client_ip_address: data.user_data?.client_ip_address,
            client_user_agent: data.user_data?.client_user_agent,
            ph: data.user_data?.ph
              ? hashData(normalizePhone(data.user_data.ph))
              : undefined,
            em: h(data.user_data?.em),
            fn: h(data.user_data?.fn),
            ln: h(data.user_data?.ln),
            ct: h(data.user_data?.ct || geo.ct),
            st: h(data.user_data?.st || geo.st),
            zp: h(data.user_data?.zp),
            country: h(data.user_data?.country || geo.country),
            external_id: h(data.user_data?.external_id),
            fbc: data.user_data?.fbc,
            fbp: data.user_data?.fbp,
          },
          custom_data: data.custom_data,
        },
      ],
    };
    if (testEventCode) payload.test_event_code = testEventCode;

    const response = await axios.post(
      `${API_URL}?access_token=${accessToken}`,
      payload,
    );
    const eventsReceived = response.data?.events_received ?? 0;
    const eventsAccepted = eventsReceived > 0;

    if (!eventsAccepted) {
      console.warn(
        "Meta CAPI: events_received=0, payload may be malformed",
        response.data,
      );
      // The atomic claim above already flipped meta_purchase_sent:true
      // before this call. Meta rejected the event, so release the claim
      // — otherwise a real retry would be silently dedup-skipped forever.
      if (data.event_name === "Purchase" && orderId) {
        await OrderModel.updateOne(
          { _id: orderId },
          { $set: { meta_purchase_sent: false } },
        ).catch((e) =>
          console.error("Meta CAPI: failed to release purchase_sent claim", e),
        );
      }
    }

    return {
      ok: eventsAccepted,
      events_received: eventsReceived,
    };
  } catch (error: any) {
    const msg = error?.response?.data || error?.message || "unknown";
    console.error("Meta CAPI error:", msg);
    // Same rollback for a hard failure (network error, 4xx/5xx) so the
    // claimed-but-never-sent order isn't stuck dedup-skipped forever.
    if (data.event_name === "Purchase" && orderId) {
      await OrderModel.updateOne(
        { _id: orderId },
        { $set: { meta_purchase_sent: false } },
      ).catch((e) =>
        console.error("Meta CAPI: failed to release purchase_sent claim", e),
      );
    }
    return { ok: false, error: typeof msg === "string" ? msg : JSON.stringify(msg) };
  }
};
