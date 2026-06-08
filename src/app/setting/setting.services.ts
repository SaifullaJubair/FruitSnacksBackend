import ApiError from "../../errors/ApiError";
import {
  getCachedSetting,
  invalidateSettingCache,
} from "../../helpers/settingCache";
import { ISettingInterface } from "./setting.interface";
import SettingModel from "./setting.model";

// S4+S5 Phase 1A — secrets stripped from PUBLIC /setting response.
// Public IDs (meta_pixel_id, gtm_id, etc.) stay visible — they already
// appear in the browser pixel script so hiding them buys nothing. The
// dangerous ones below (CAPI tokens + provider passwords) NEVER reach
// the browser. To read these, hit /setting/secrets which requires the
// setting_secrets_update permission flag.
//
// CAPI services (meta.pixel.service.ts, tiktok.pixel.service.ts) read
// the full doc directly via SettingModel — they bypass this strip.
export const SETTING_SECRET_FIELDS = [
  "meta_capi_access_token",
  "tiktok_capi_access_token",
  "meta_test_event_code",
  "tiktok_test_event_code",
  "sms_api_key",
  "sms_api_secret",
  "email_password",
  "pathao_password",
  "pathao_client_secret",
  "steadfast_api_secret",
  "redx_api_key",
  // Track D: live-chat embed code is arbitrary JS — treated as secret so it
  // never appears in public /setting response (same pattern as CAPI tokens).
  "chat_livechat_embed_code",
];

const PUBLIC_PROJECTION = SETTING_SECRET_FIELDS.map((f) => `-${f}`).join(" ");

// get A Setting (PUBLIC — secrets stripped)
export const getSettingServices = async (): Promise<
  ISettingInterface[] | any
> => {
  const docs = await SettingModel.find({})
    .select(PUBLIC_PROJECTION)
    .lean();
  // BE-side backfill: inject L9 home_section_array defaults for fresh/pre-TrackD docs.
  const result = (docs || []).map((doc: any) => {
    if (!doc.home_section_array || doc.home_section_array.length === 0) {
      return { ...doc, home_section_array: HOME_SECTION_DEFAULTS };
    }
    return doc;
  });
  return result;
};

// admin-only — returns lastFour summary of each secret, NOT the raw
// values. The admin UI only needs the masked display (`••••3a4f`),
// never the full token. Even though this endpoint is permission-guarded,
// returning full tokens here would put them in browser memory / DevTools
// history for no UX gain.
//
// To rotate a secret the admin types a NEW value into the form — we
// never read the existing one back into the browser.
export const getSettingWithSecretsServices = async (): Promise<any> => {
  const setting = await SettingModel.findOne({}).lean();
  if (!setting) return null;

  const lastFour = (v: any) =>
    typeof v === "string" && v.length > 0
      ? v.length > 4
        ? v.slice(-4)
        : v
      : "";

  // Mirror the public doc + add a `secrets_summary` object with
  // lastFour-only previews for the admin UI to mask.
  const publicView: any = { ...setting };
  for (const f of SETTING_SECRET_FIELDS) {
    delete publicView[f];
  }
  publicView.secrets_summary = SETTING_SECRET_FIELDS.reduce(
    (acc: any, f) => {
      acc[f] = lastFour((setting as any)[f]);
      return acc;
    },
    {} as Record<string, string>,
  );
  return publicView;
};

// admin-only — patches ONLY secret fields. Other fields ignored even if
// sent in body, so this endpoint can't be used as a backdoor to mutate
// non-secret settings without proper permission.
export const updateSettingSecretsServices = async (
  data: Partial<ISettingInterface>,
): Promise<ISettingInterface | null> => {
  const setting = await SettingModel.findOne({});
  if (!setting) {
    throw new ApiError(404, "Setting document not found");
  }

  const patch: any = {};
  for (const field of SETTING_SECRET_FIELDS) {
    const incoming = (data as any)[field];
    // Empty string / undefined / null = "no change" (don't wipe existing).
    // To clear a secret, admin would need an explicit delete flow — out
    // of scope for Phase 1A.
    if (typeof incoming === "string" && incoming.trim().length > 0) {
      patch[field] = incoming.trim();
    }
  }

  if (Object.keys(patch).length === 0) {
    return setting.toObject();
  }

  await SettingModel.updateOne({ _id: setting._id }, { $set: patch });
  invalidateSettingCache();
  // Strip secrets from the returned doc — even though this endpoint is
  // admin-only, secrets in a PATCH response sit in Network/Redux
  // DevTools history. The admin already knows what they typed; the
  // updated doc just confirms which non-secret fields surround it.
  const updated = await SettingModel.findById(setting._id)
    .select(PUBLIC_PROJECTION)
    .lean();
  return updated;
};

// Currency code from settings (singleton). Falls back to "BDT" when unset.
// Used by payment gateways (SSLCommerz expects ISO 4217) + product feed XML.
export const getCurrencyCode = async (): Promise<string> => {
  const setting: any = await SettingModel.findOne({})
    .select("currency_code")
    .lean();
  return setting?.currency_code || "BDT";
};

// M28: symbol for "৳500" style prefix display. Fallback "৳" matches the
// historical hardcoded default; any clone can override via Admin Settings.
export const getCurrencySymbol = async (): Promise<string> => {
  const setting: any = await SettingModel.findOne({})
    .select("currency_symbol")
    .lean();
  return setting?.currency_symbol || "৳";
};

// M28: name for spelled-out display ("500 টাকা"). Used in SMS/email/order
// confirmation copy where symbol alone reads awkwardly. Fallback "টাকা".
export const getCurrencyName = async (): Promise<string> => {
  const setting: any = await SettingModel.findOne({})
    .select("currency_name")
    .lean();
  return setting?.currency_name || "টাকা";
};

// M28: bundle accessor — saves a roundtrip when caller needs more than one.
export const getCurrencyBundle = async (): Promise<{
  symbol: string;
  code: string;
  name: string;
}> => {
  const setting: any = await SettingModel.findOne({})
    .select("currency_symbol currency_code currency_name")
    .lean();
  return {
    symbol: setting?.currency_symbol || "৳",
    code: setting?.currency_code || "BDT",
    name: setting?.currency_name || "টাকা",
  };
};

// Create A Setting
export const postSettingServices = async (
  data: ISettingInterface
): Promise<ISettingInterface | {}> => {
  const createSetting: ISettingInterface | {} = await SettingModel.create(data);
  invalidateSettingCache();
  return createSetting;
};

// update A Setting
//
// C12 hardening (Sprint 2):
// 1. Use `$set: data` instead of full-doc replace. Each settings tab in Admin
//    sends only its own fields; the bare `data` form would silently wipe
//    every other tab's values back to schema defaults.
// 2. Strip any SETTING_SECRET_FIELDS key whose incoming value is empty —
//    the SmsSettings/AnalyticsSettings tabs render secret inputs as empty
//    strings in view mode (we never round-trip the real value to the
//    browser). Without this guard, saving an unrelated field would wipe the
//    stored CAPI token / SMS API key / etc.
// 3. Drop `_id` from the payload before $set so we don't try to overwrite
//    the doc's primary key.
export const updateSettingServices = async (
  data: ISettingInterface,
): Promise<ISettingInterface | any> => {
  const settingData = await SettingModel.findOne({ _id: data?._id });
  if (!settingData) {
    throw new ApiError(400, "Nothing found for update");
  }

  const patch: any = { ...data };
  delete patch._id;
  delete patch.createdAt;
  delete patch.updatedAt;

  for (const field of SETTING_SECRET_FIELDS) {
    const incoming = patch[field];
    if (
      incoming === "" ||
      incoming === null ||
      incoming === undefined ||
      (typeof incoming === "string" && incoming.trim().length === 0)
    ) {
      delete patch[field];
    }
  }

  const updateSetting = await SettingModel.updateOne(
    { _id: data?._id },
    { $set: patch },
    { runValidators: true },
  );
  invalidateSettingCache();
  return updateSetting;
};

// ─── C12: SMS config resolver (single source of truth) ─────────────────────
//
// Replaces the inline `SettingModel.findOne()` + .env-fallback duplicated
// across send.otp.phone.ts and send.order.sms.ts. Reads via the existing
// 5-minute settingCache so per-SMS DB hits drop to zero in steady state.
//
// Returns `null` when `sms_enabled === false` so callers can short-circuit
// without attempting BulkSMS. Returns `null` when api_key / sender_id are
// both missing from DB AND .env (provider truly unconfigured).
//
// `secret` is treated as optional — BulkSMS BD only needs api_key + sender_id;
// other providers (in future) may need both.
export interface ISmsConfig {
  apiKey: string;
  senderId: string;
  secret?: string;
  providerName: string;
}

export const getSmsConfig = async (): Promise<ISmsConfig | null> => {
  const setting = await getCachedSetting().catch(() => null);

  // Owner explicitly disabled SMS — silent no-op.
  if (setting && setting.sms_enabled === false) {
    return null;
  }

  const apiKey =
    (setting && setting.sms_api_key) || process.env.BULKSMS_API_KEY || "";
  const senderId =
    (setting && setting.sms_sender_id) || process.env.BULKSMS_SENDER_ID || "";
  const secret =
    (setting && setting.sms_api_secret) ||
    process.env.BULKSMS_API_SECRET ||
    "";
  const providerName =
    (setting && setting.sms_provider_name) || "BulkSMS BD";

  if (!apiKey || !senderId) {
    return null;
  }

  return {
    apiKey,
    senderId,
    secret: secret || undefined,
    providerName,
  };
};

// H-B: Email config helper — mirrors getSmsConfig pattern.
// Returns null when email_provider_enabled=false or creds missing.
export interface IEmailConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  fromAddress: string;
  fromName: string;
}

export const getEmailConfig = async (
  { ignoreEnabledFlag = false } = {},
): Promise<IEmailConfig | null> => {
  const setting = await getCachedSetting().catch(() => null);

  if (!ignoreEnabledFlag && setting && setting.email_provider_enabled === false) {
    return null;
  }

  const host = (setting && setting.email_host) || process.env.SMTP_HOST || "";
  const port = (setting && setting.email_port) || Number(process.env.SMTP_PORT) || 587;
  const username = (setting && setting.email_username) || process.env.SMTP_USER || "";
  const password = (setting && setting.email_password) || process.env.SMTP_PASS || "";
  const fromAddress = (setting && setting.email_from_address) || process.env.SMTP_FROM_ADDRESS || "";
  const fromName = (setting && setting.email_from_name) || process.env.SMTP_FROM_NAME || "FruitSnacks";

  if (!host || !username || !password || !fromAddress) {
    return null;
  }

  return { host, port, username, password, fromAddress, fromName };
};

// ─── Track D: Home Layout ──────────────────────────────────────────────────

// L9 DTC-research default section order. Applied at response-time when the
// settings doc has no home_section_array (fresh clone or pre-Track-D doc).
// Not persisted to DB on GET — only written when admin explicitly saves.
export const HOME_SECTION_DEFAULTS = [
  { id: "trust_strip",         enabled: true,  order: 1  },
  { id: "feature_categories",  enabled: true,  order: 2  },
  { id: "flash_sale",          enabled: true,  order: 3  },
  { id: "bestsellers",         enabled: true,  order: 4  },
  { id: "offers_block",        enabled: true,  order: 5  },
  { id: "new_arrivals",        enabled: true,  order: 6  },
  { id: "brand_story",         enabled: true,  order: 7  },
  { id: "reviews_carousel",    enabled: true,  order: 8  },
  { id: "trending_products",   enabled: true,  order: 9  },
  { id: "just_for_you",        enabled: false, order: 10 },
  { id: "ecommerce_choice",    enabled: false, order: 11 },
  { id: "category_wise_strip", enabled: true,  order: 12 },
  { id: "promo_banner",        enabled: false, order: 13 },
  { id: "site_faq",            enabled: true,  order: 14 },
  { id: "newsletter",          enabled: true,  order: 15 },
];

// Home-layout fields that are handled by /setting/home_layout (kept separate
// from general settings tabs to avoid collision + allow granular PATCH).
const HOME_LAYOUT_FIELDS = [
  "home_section_array",
  "topbar_show", "topbar_announcement_text", "topbar_show_track_order", "topbar_show_hotline",
  "nav_category_mode", "nav_show_search_sticky", "nav_show_wishlist_icon", "nav_show_compare_icon", "nav_extra_links_json",
  "hero_show", "hero_variant", "hero_autoplay_seconds", "hero_show_arrows",
  "trust_strip_source",
  "feature_categories_limit", "feature_categories_title",
  "flash_sale_limit", "flash_sale_title",
  "trending_products_limit", "trending_products_title",
  "bestsellers_limit", "bestsellers_title",
  "new_arrivals_limit", "new_arrivals_title",
  "just_for_you_limit", "just_for_you_title",
  "ecommerce_choice_limit", "ecommerce_choice_title",
  "category_wise_strip_limit", "category_wise_strip_title", "category_wise_strip_category_id",
  "offers_block_limit", "offers_block_title", "offers_block_layout",
  "promo_banner_image", "promo_banner_image_key", "promo_banner_url", "promo_banner_text_overlay",
  "brand_story_title", "brand_story_text", "brand_story_image", "brand_story_image_key",
  "brand_story_cta_label", "brand_story_cta_url",
  "reviews_carousel_source", "reviews_carousel_ids", "reviews_carousel_limit", "reviews_carousel_title",
  "site_faq_title",
  "newsletter_title", "newsletter_collect",
  "footer_show_payment_strip", "footer_payment_methods",
  "footer_show_delivery_strip", "footer_delivery_partners", "footer_show_mini_newsletter",
  "chat_messenger_show", "chat_messenger_page_id",
  "chat_livechat_show", "chat_widgets_position",
];

export const getHomeLayoutSettingServices = async (): Promise<any> => {
  const setting = await SettingModel.findOne({})
    .select(HOME_LAYOUT_FIELDS.join(" "))
    .lean();
  if (!setting) return null;

  // BE-side backfill: if home_section_array missing/empty, inject L9 defaults.
  // Response-time only — not persisted to DB until admin explicitly saves.
  const doc: any = { ...setting };
  if (!doc.home_section_array || doc.home_section_array.length === 0) {
    doc.home_section_array = HOME_SECTION_DEFAULTS;
  }
  return doc;
};

export const updateHomeLayoutSettingServices = async (
  data: Partial<ISettingInterface>,
): Promise<any> => {
  const setting = await SettingModel.findOne({});
  if (!setting) throw new ApiError(404, "Setting document not found");

  const patch: any = {};
  for (const field of HOME_LAYOUT_FIELDS) {
    const val = (data as any)[field];
    if (val !== undefined) {
      patch[field] = val;
    }
  }

  // S3 cleanup: if admin uploads a new promo/brand_story image, delete the old key.
  if (patch.promo_banner_image && (setting as any).promo_banner_image_key &&
      patch.promo_banner_image !== (setting as any).promo_banner_image) {
    // old key queued for S3 delete — handled in controller
    patch._old_promo_banner_key = (setting as any).promo_banner_image_key;
  }
  if (patch.brand_story_image && (setting as any).brand_story_image_key &&
      patch.brand_story_image !== (setting as any).brand_story_image) {
    patch._old_brand_story_key = (setting as any).brand_story_image_key;
  }

  // nav_extra_links_json: max 4 links guard
  if (patch.nav_extra_links_json) {
    try {
      const links = JSON.parse(patch.nav_extra_links_json);
      if (Array.isArray(links) && links.length > 4) {
        throw new ApiError(400, "nav_extra_links_json: maximum 4 links allowed");
      }
    } catch (e: any) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(400, "nav_extra_links_json: invalid JSON");
    }
  }

  delete patch._old_promo_banner_key;
  delete patch._old_brand_story_key;

  await SettingModel.updateOne({ _id: setting._id }, { $set: patch });
  invalidateSettingCache();
  return SettingModel.findById(setting._id).select(HOME_LAYOUT_FIELDS.join(" ")).lean();
};

// C12: storefront base URL for SMS links / share URLs. DB-first, .env
// fallback, hardcoded last-ditch default. Mirrors qr_storefront_base_url
// pattern so buyers can swap domain without redeploy.
export const getStorefrontBaseUrl = async (): Promise<string> => {
  const setting = await getCachedSetting().catch(() => null);
  const fromDb =
    (setting as any)?.storefront_base_url &&
    String((setting as any).storefront_base_url).trim();
  if (fromDb) return fromDb.replace(/\/+$/, "");
  const fromEnv = process.env.SITE_URL && process.env.SITE_URL.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return "https://fruitsnacksbd.com";
};
