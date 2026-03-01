import { Schema, model } from "mongoose";
import { IPageSeo } from "./pageSeo.interface";

const PageSeoSchema = new Schema<IPageSeo>(
  {
    page_key: { type: String, required: true, unique: true, trim: true },
    path: {
      type: String,
      required: false, // Make it optional
      trim: true,
      default: "", // Default to empty string
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    noIndex: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const PageSeoModel = model<IPageSeo>("PageSeo", PageSeoSchema);
export default PageSeoModel;
