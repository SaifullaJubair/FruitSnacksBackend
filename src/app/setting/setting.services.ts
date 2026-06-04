import ApiError from "../../errors/ApiError";
import { invalidateSettingCache } from "../../helpers/settingCache";
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
];

const PUBLIC_PROJECTION = SETTING_SECRET_FIELDS.map((f) => `-${f}`).join(" ");

// get A Setting (PUBLIC — secrets stripped)
export const getSettingServices = async (): Promise<
  ISettingInterface[] | any
> => {
  const getSetting = await SettingModel.find({})
    .select(PUBLIC_PROJECTION)
    .lean();
  return getSetting || [];
};

// admin-only — returns FULL doc including secrets. Caller (controller)
// must guard with verifyToken("setting_secrets_update").
export const getSettingWithSecretsServices = async (): Promise<
  ISettingInterface | null
> => {
  const setting = await SettingModel.findOne({}).lean();
  return setting || null;
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
  const updated = await SettingModel.findById(setting._id).lean();
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
export const updateSettingServices = async (
  data: ISettingInterface
): Promise<ISettingInterface | any> => {
  const settingData = await SettingModel.findOne({ _id: data?._id });
  if (!settingData) {
    throw new ApiError(400, "Nothing found for update");
  }
  const updateSetting = await SettingModel.updateOne({ _id: data?._id }, data, {
    runValidators: true,
  });
  invalidateSettingCache();
  return updateSetting;
};
