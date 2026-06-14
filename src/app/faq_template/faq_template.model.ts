import { Schema, model } from "mongoose";
import { IFaqTemplateInterface } from "./faq_template.interface";

const faqTemplateSchema = new Schema<IFaqTemplateInterface>(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true },
    // Free-text topic label (was an enum). Defaults to "general" so a template
    // saved without one still groups sensibly. Indexed for the filter query.
    category: {
      type: String,
      trim: true,
      default: "general",
      required: true,
      index: true,
    },
    // Optional product-category scope for picker suggestions (see interface).
    // Empty array = global. Indexed so a future server-side scope filter is cheap.
    category_ids: {
      type: [{ type: Schema.Types.ObjectId, ref: "categories" }],
      default: [],
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
