import FaqTemplateModel from "./faq_template.model";
import { IFaqTemplateInterface } from "./faq_template.interface";

export const createFaqTemplateService = async (
  data: Partial<IFaqTemplateInterface>,
): Promise<IFaqTemplateInterface> => {
  const created = await FaqTemplateModel.create(data);
  return created.toObject();
};

export const updateFaqTemplateService = async (
  _id: string,
  data: Partial<IFaqTemplateInterface>,
) => {
  return FaqTemplateModel.updateOne({ _id }, data, { runValidators: true });
};

export const findFaqTemplateByIdService = async (_id: string) => {
  return FaqTemplateModel.findById(_id).lean();
};

interface ListArgs {
  category?: string;
  is_active?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export const listFaqTemplatesService = async (args: ListArgs) => {
  const filter: any = {};
  if (args.category) filter.category = args.category;
  if (args.is_active !== undefined) filter.is_active = args.is_active;
  if (args.search) {
    filter.$or = [
      { question: { $regex: args.search, $options: "i" } },
      { answer: { $regex: args.search, $options: "i" } },
    ];
  }
  const page = Math.max(1, args.page ?? 1);
  const limit = Math.min(200, args.limit ?? 50);
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    FaqTemplateModel.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    FaqTemplateModel.countDocuments(filter),
  ]);
  return { data, total };
};

export const deleteFaqTemplateService = async (_id: string) => {
  return FaqTemplateModel.deleteOne({ _id });
};

// Distinct topic labels currently in use — powers the admin datalist so the
// `category` free-text input suggests existing topics (plus the seeded
// defaults, merged on the client). Cheap distinct query, no pagination needed.
export const listFaqTemplateTopicsService = async (): Promise<string[]> => {
  const topics = await FaqTemplateModel.distinct("category");
  return (topics as string[]).filter(Boolean).sort();
};
