import { Schema, model } from "mongoose";
import { INewsletterSubscriberInterface } from "./newsletterSubscriber.interface";

const newsletterSubscriberSchema = new Schema<INewsletterSubscriberInterface>(
  {
    contact: { type: String, required: true, trim: true },
    channel: { type: String, enum: ["email", "sms"], required: true },
    source: { type: String, enum: ["home", "footer", "checkout"], default: "home" },
    status: { type: String, enum: ["active", "unsubscribed"], default: "active" },
    subscribed_at: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// prevent duplicate contact+channel combos
newsletterSubscriberSchema.index({ contact: 1, channel: 1 }, { unique: true });
newsletterSubscriberSchema.index({ status: 1, createdAt: -1 });

const NewsletterSubscriberModel = model<INewsletterSubscriberInterface>(
  "newsletter_subscribers",
  newsletterSubscriberSchema,
);
export default NewsletterSubscriberModel;
