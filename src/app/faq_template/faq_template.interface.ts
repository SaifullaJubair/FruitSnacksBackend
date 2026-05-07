import { Types } from "mongoose";

export type FaqTemplateCategory =
  | "shelf_life"
  | "storage"
  | "ingredients"
  | "usage"
  | "health"
  | "general";

export interface IFaqTemplateInterface {
  _id?: Types.ObjectId;
  question: string;
  answer: string;
  category: FaqTemplateCategory;
  is_active: boolean;
  created_by?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export const faqTemplateSearchableFields = ["question", "answer", "category"];
