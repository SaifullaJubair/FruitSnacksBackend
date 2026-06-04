import ApiError from "../../errors/ApiError";
import { ISettingInterface } from "./setting.interface";
import SettingModel from "./setting.model";

// get A Setting
export const getSettingServices = async (): Promise<
  ISettingInterface[] | any
> => {
  const getSetting = await SettingModel.find({}).lean();
  return getSetting || [];
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
  return updateSetting;
};
