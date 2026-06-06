import ApiError from "../../errors/ApiError";
import {
  INewsletterSubscriberInterface,
  newsletterSubscriberSearchableFields,
} from "./newsletterSubscriber.interface";
import NewsletterSubscriberModel from "./newsletterSubscriber.model";

export const subscribeNewsletterServices = async (
  data: Pick<INewsletterSubscriberInterface, "contact" | "channel" | "source">,
): Promise<INewsletterSubscriberInterface> => {
  const { contact, channel, source } = data;
  if (!contact || !channel) throw new ApiError(400, "contact and channel are required");

  // Upsert: if already subscribed, re-activate; if new, create.
  const result = await NewsletterSubscriberModel.findOneAndUpdate(
    { contact, channel },
    { $set: { status: "active", source, subscribed_at: new Date() } },
    { upsert: true, new: true },
  );
  return result;
};

export const findAllSubscriberServices = async (
  limit: number,
  skip: number,
  searchTerm?: string,
  status?: string,
): Promise<{ data: INewsletterSubscriberInterface[]; total: number }> => {
  const query: any = {};
  if (status) query.status = status;
  if (searchTerm) {
    query.$or = newsletterSubscriberSearchableFields.map((field) => ({
      [field]: { $regex: searchTerm, $options: "i" },
    }));
  }
  const [data, total] = await Promise.all([
    NewsletterSubscriberModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    NewsletterSubscriberModel.countDocuments(query),
  ]);
  return { data, total };
};

export const deleteSubscriberServices = async (id: string): Promise<void> => {
  const existing = await NewsletterSubscriberModel.findById(id);
  if (!existing) throw new ApiError(404, "Subscriber not found");
  await NewsletterSubscriberModel.deleteOne({ _id: id });
};

// CSV export — max 5000 rows to prevent memory DoS
export const exportSubscribersCsvServices = async (
  status?: string,
): Promise<INewsletterSubscriberInterface[]> => {
  const query: any = {};
  if (status) query.status = status;
  return NewsletterSubscriberModel.find(query)
    .sort({ createdAt: -1 })
    .limit(5000)
    .lean();
};
