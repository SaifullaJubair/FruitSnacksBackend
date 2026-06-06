import { Schema, model } from "mongoose";
import { ISiteFaqInterface } from "./siteFaq.interface";

const siteFaqSchema = new Schema<ISiteFaqInterface>(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    order_no: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    _publisher_id: { type: Schema.Types.ObjectId, ref: "adminregistrations" },
    _updated_by: { type: Schema.Types.ObjectId, ref: "adminregistrations" },
  },
  { timestamps: true },
);

siteFaqSchema.index({ status: 1, order_no: 1 });

const SiteFaqModel = model<ISiteFaqInterface>("site_faqs", siteFaqSchema);
export default SiteFaqModel;
