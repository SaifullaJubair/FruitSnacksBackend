import ApiError from "../../errors/ApiError";
import { ISiteFaqInterface, siteFaqSearchableFields } from "./siteFaq.interface";
import SiteFaqModel from "./siteFaq.model";

export const postSiteFaqServices = async (
  data: ISiteFaqInterface,
): Promise<ISiteFaqInterface> => {
  const result = await SiteFaqModel.create(data);
  return result;
};

export const findAllSiteFaqServices = async (
  limit: number,
  skip: number,
  searchTerm?: string,
): Promise<{ data: ISiteFaqInterface[]; total: number }> => {
  const query: any = {};
  if (searchTerm) {
    query.$or = siteFaqSearchableFields.map((field) => ({
      [field]: { $regex: searchTerm, $options: "i" },
    }));
  }
  const [data, total] = await Promise.all([
    SiteFaqModel.find(query).sort({ order_no: 1, createdAt: 1 }).skip(skip).limit(limit).lean(),
    SiteFaqModel.countDocuments(query),
  ]);
  return { data, total };
};

// Public — only active FAQs for storefront
export const findActiveSiteFaqServices = async (): Promise<ISiteFaqInterface[]> => {
  return SiteFaqModel.find({ status: "active" })
    .sort({ order_no: 1, createdAt: 1 })
    .lean();
};

export const updateSiteFaqServices = async (
  id: string,
  data: Partial<ISiteFaqInterface>,
): Promise<ISiteFaqInterface | null> => {
  const existing = await SiteFaqModel.findById(id);
  if (!existing) throw new ApiError(404, "Site FAQ not found");
  const patch = { ...data };
  delete (patch as any)._id;
  await SiteFaqModel.updateOne({ _id: id }, { $set: patch });
  return SiteFaqModel.findById(id).lean();
};

export const deleteSiteFaqServices = async (id: string): Promise<void> => {
  const existing = await SiteFaqModel.findById(id);
  if (!existing) throw new ApiError(404, "Site FAQ not found");
  await SiteFaqModel.deleteOne({ _id: id });
};
