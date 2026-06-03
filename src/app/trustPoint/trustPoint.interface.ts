import { Document, Types } from "mongoose";

// A single "আমাদের প্রতিশ্রুতি" (brand promise) tile shown on every themed
// product page. Either icon_key (curated icon, e.g. "lu:Leaf") OR icon_url
// (custom uploaded SVG/PNG) supplies the visual; icon_url wins if both set.
export interface ITrustPointItem {
  icon_key?: string;
  icon_url?: string;
  title?: string;
  subtitle?: string;
}

// Singleton document holding the whole brand-promise list. There is only ever
// one document in this collection (like settings) — admin edits the array as a
// whole via PUT.
export interface ITrustPointInterface extends Document {
  points: ITrustPointItem[];
  _updated_by?: Types.ObjectId;
}
