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
export const getCurrencyCode = async (): Promise<string> => {
  const setting: any = await SettingModel.findOne({})
    .select("currency_code")
    .lean();
  return setting?.currency_code || "BDT";
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
