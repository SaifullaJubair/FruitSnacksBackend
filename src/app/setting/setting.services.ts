import ApiError from "../../errors/ApiError";
import { ISettingInterface } from "./setting.interface";
import SettingModel from "./setting.model";

// get A Setting
export const getSettingServices = async (): Promise<
  ISettingInterface[] | any
> => {
  const getSetting: ISettingInterface | {} = await SettingModel.find({});
  return getSetting;
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
