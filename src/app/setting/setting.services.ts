import ApiError from "../../errors/ApiError";
import { ISettingInterface } from "./setting.interface";
import SettingModel from "./setting.model";

// Derive trust_points array from existing card_one..card_four fields.
// Keeps DB schema unchanged; frontend gets a clean array regardless of how
// many cards are populated.
const buildTrustPoints = (s: any) => {
  const out: { logo?: string; title?: string }[] = [];
  for (const i of ["one", "two", "three", "four"]) {
    const logo = s?.[`card_${i}_logo`];
    const title = s?.[`card_${i}_title`];
    if (logo || title) out.push({ logo, title });
  }
  return out;
};

// get A Setting
export const getSettingServices = async (): Promise<
  ISettingInterface[] | any
> => {
  const getSetting = await SettingModel.find({}).lean();
  return (getSetting || []).map((s: any) => ({
    ...s,
    trust_points: buildTrustPoints(s),
  }));
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
