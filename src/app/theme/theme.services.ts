import mongoose from "mongoose";
import ThemeModel from "./theme.model";
import { IThemeInterface } from "./theme.interface";
import { generateThemeColors } from "../../helpers/theme.color.gen";
import ProductModel from "../product/product.model";

// Sanitize input to keep only the 3 admin-supplied colors;
// always regenerate the 6 derived shades so the doc never gets stale.
const buildColorsFromInput = (input: any) => {
  const primary = input?.primary;
  const page_bg = input?.page_bg;
  const accent = input?.accent;
  if (!primary || !page_bg || !accent) {
    return null;
  }
  return generateThemeColors(primary, page_bg, accent);
};

export const createThemeService = async (
  data: Partial<IThemeInterface> & { colors: any },
): Promise<IThemeInterface> => {
  const colors = buildColorsFromInput(data.colors);
  if (!colors) {
    throw new Error("colors.primary, colors.page_bg, colors.accent are required");
  }
  const created = await ThemeModel.create({ ...data, colors });
  return created.toObject();
};

export const updateThemeService = async (
  _id: string,
  data: Partial<IThemeInterface> & { colors?: any },
): Promise<any> => {
  const update: any = { ...data };
  if (data.colors && (data.colors.primary || data.colors.page_bg || data.colors.accent)) {
    // Re-fetch existing to allow partial color updates
    const existing = await ThemeModel.findById(_id).lean();
    if (!existing) return { matchedCount: 0 };
    const merged = {
      primary: data.colors.primary ?? existing.colors.primary,
      page_bg: data.colors.page_bg ?? existing.colors.page_bg,
      accent: data.colors.accent ?? existing.colors.accent,
    };
    update.colors = generateThemeColors(merged.primary, merged.page_bg, merged.accent);
  }
  return ThemeModel.updateOne({ _id }, update, { runValidators: true });
};

export const findThemeByIdService = async (_id: string) => {
  return ThemeModel.findById(_id).lean();
};

export const findThemeBySlugService = async (slug: string) => {
  return ThemeModel.findOne({ theme_slug: slug }).lean();
};

interface ListThemesArgs {
  status?: string;
  theme_for?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const listThemesService = async (args: ListThemesArgs) => {
  const filter: any = {};
  if (args.status) filter.status = args.status;
  if (args.theme_for) filter.theme_for = { $regex: args.theme_for, $options: "i" };
  if (args.search) {
    filter.$or = [
      { theme_name: { $regex: args.search, $options: "i" } },
      { theme_for: { $regex: args.search, $options: "i" } },
      { theme_slug: { $regex: args.search, $options: "i" } },
    ];
  }
  const page = Math.max(1, args.page ?? 1);
  const limit = Math.min(100, args.limit ?? 20);
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    ThemeModel.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    ThemeModel.countDocuments(filter),
  ]);
  return { data, total };
};

export const deleteThemeService = async (_id: string) => {
  const theme = await ThemeModel.findById(_id);
  if (!theme) {
    return { deletedCount: 0, reason: "not_found" as const };
  }
  if (theme.used_in_products > 0) {
    return { deletedCount: 0, reason: "in_use" as const, used_in_products: theme.used_in_products };
  }
  // Soft delete by archiving status (audit trail) instead of hard delete
  await ThemeModel.updateOne({ _id }, { status: "archived" });
  return { deletedCount: 1, reason: "archived" as const };
};

export const approveThemeService = async (_id: string, adminId?: string) => {
  return ThemeModel.updateOne(
    { _id },
    {
      preview_approved: true,
      status: "active",
      approved_by: adminId ?? null,
      approved_at: new Date(),
    },
  );
};

export const addFloatingAssetService = async (
  _id: string,
  asset: any,
) => {
  return ThemeModel.updateOne({ _id }, { $push: { floating_assets: asset } });
};

export const removeFloatingAssetService = async (
  _id: string,
  assetIndex: number,
) => {
  const theme = await ThemeModel.findById(_id);
  if (!theme) return { modifiedCount: 0 };
  if (assetIndex < 0 || assetIndex >= theme.floating_assets.length) {
    return { modifiedCount: 0 };
  }
  const removedAsset = theme.floating_assets[assetIndex];
  theme.floating_assets.splice(assetIndex, 1);
  await theme.save();
  return { modifiedCount: 1, removed: removedAsset };
};

// Counter helpers — called by product service when theme_id changes
export const incThemeUsageService = async (
  themeId: string,
  delta: number,
  session?: mongoose.ClientSession,
) => {
  if (!themeId) return;
  await ThemeModel.updateOne(
    { _id: themeId },
    [
      {
        $set: {
          used_in_products: { $max: [{ $add: ["$used_in_products", delta] }, 0] },
        },
      },
      {
        $set: {
          is_deletable: { $eq: ["$used_in_products", 0] },
        },
      },
    ],
    session ? { session } : undefined,
  );
};

export const recountThemeUsageService = async (themeId: string) => {
  const count = await ProductModel.countDocuments({ theme_id: themeId });
  await ThemeModel.updateOne(
    { _id: themeId },
    { used_in_products: count, is_deletable: count === 0 },
  );
  return count;
};
