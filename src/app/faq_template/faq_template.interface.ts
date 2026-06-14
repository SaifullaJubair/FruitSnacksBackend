import { Types } from "mongoose";

// `category` is a free-text TOPIC label (shelf_life / storage / health / …).
// It was a hardcoded enum; opened up to a string so a buyer in any niche can
// coin their own topics (cosmetics → "skin_type", electronics → "warranty")
// without a code change. These six remain the default suggestions in the UI.
export const FAQ_DEFAULT_TOPICS = [
  "shelf_life",
  "storage",
  "ingredients",
  "usage",
  "health",
  "general",
];

export interface IFaqTemplateInterface {
  _id?: Types.ObjectId;
  question: string;
  answer: string;
  /** Free-text topic label — see FAQ_DEFAULT_TOPICS for the seeded suggestions. */
  category: string;
  /**
   * Optional product-category scope. When non-empty, the page-content FAQ
   * picker SUGGESTS this template (sorts it to the top) for products whose
   * category_path intersects these ids — including descendants, so tagging a
   * parent category cascades to its sub-categories. Empty = global (suggested
   * for every product).
   */
  category_ids?: Types.ObjectId[];
  is_active: boolean;
  created_by?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export const faqTemplateSearchableFields = ["question", "answer", "category"];
