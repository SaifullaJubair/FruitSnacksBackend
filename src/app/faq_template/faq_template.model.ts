import { Schema, model } from "mongoose";
import { IFaqTemplateInterface } from "./faq_template.interface";

const faqTemplateSchema = new Schema<IFaqTemplateInterface>(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true },
    category: {
      type: String,
      enum: [
        "shelf_life",
        "storage",
        "ingredients",
        "usage",
        "health",
        "general",
      ],
      required: true,
      index: true,
    },
    is_active: { type: Boolean, default: true, index: true },
    created_by: { type: Schema.Types.ObjectId, ref: "admins" },
  },
  { timestamps: true },
);

const FaqTemplateModel = model<IFaqTemplateInterface>(
  "faq_templates",
  faqTemplateSchema,
);
export default FaqTemplateModel;
