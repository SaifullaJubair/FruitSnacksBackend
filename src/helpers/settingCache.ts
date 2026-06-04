import SettingModel from "../app/setting/setting.model";
import { ISettingInterface } from "../app/setting/setting.interface";

// S4+S5 Phase 1A — in-memory cache for the singleton settings doc.
// CAPI services hit this on every event; pulling the full doc from
// Mongo each time would add ~5-15ms per event. 5min TTL means worst
// case an admin token rotation takes up to 5 minutes to reach CAPI —
// acceptable trade-off for the throughput win.
//
// To force-refresh after an admin secret update, call invalidateSettingCache()
// from the controller path that mutates settings.

const TTL_MS = 5 * 60 * 1000;

let cached: ISettingInterface | null = null;
let cachedAt = 0;

export const getCachedSetting = async (): Promise<ISettingInterface | null> => {
  const now = Date.now();
  if (cached && now - cachedAt < TTL_MS) {
    return cached;
  }
  const fresh = await SettingModel.findOne({}).lean();
  cached = (fresh as ISettingInterface) || null;
  cachedAt = now;
  return cached;
};

export const invalidateSettingCache = (): void => {
  cached = null;
  cachedAt = 0;
};
