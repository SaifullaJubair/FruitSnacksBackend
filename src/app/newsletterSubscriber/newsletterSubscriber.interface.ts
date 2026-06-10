import { Types } from "mongoose";

export interface INewsletterSubscriberInterface {
  _id?: Types.ObjectId;
  contact: string; // email address or phone number
  channel: "email" | "sms";
  source: "home" | "footer" | "checkout";
  status: "active" | "unsubscribed";
  subscribed_at?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export const newsletterSubscriberSearchableFields = ["contact", "channel", "source"];
