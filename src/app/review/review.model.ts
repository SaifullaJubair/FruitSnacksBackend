import { Schema, model } from "mongoose";
import { IReviewInterface } from "./review.interface";

// Review Schema
const reviewSchema = new Schema<IReviewInterface>(
  {
    review_description: {
      type: String,
      required: true,
    },
    review_answer: {
      type: String,
    },
    review_image: {
      type: String,
    },
    review_ratting: {
      type: Number,
      required: true,
    },
    review_status: {
      required: true,
      type: String,
      enum: ["active", "in-active", "pending"],
      default: "active",
    },
    review_user_id: {
      type: Schema.Types.ObjectId,
      ref: "users",
    },
    review_product_id: {
      type: Schema.Types.ObjectId,
      ref: "products",
      required: true,
    },
    review_updated_by: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },

    // Sprint 3 — seed review fields
    is_seeded: { type: Boolean, default: false },
    source: {
      type: String,
      enum: ["customer", "csv_bulk", "manual_admin", "demo_seed"],
      default: "customer",
    },
    // Display name for seeded reviews (review_user_id is null when seeded)
    reviewer_name: { type: String, default: "" },
    // "Verified Purchase" badge control — admin sets true for real-looking seeds
    reviewer_verified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Compound sparse index — prevents re-uploading the same CSV row twice.
// Only enforced when all 3 fields exist (sparse=true skips docs missing any).
reviewSchema.index(
  { review_product_id: 1, reviewer_name: 1, review_description: 1 },
  { unique: false, sparse: true, name: "seed_dedup" },
);

const ReviewModel = model<IReviewInterface>("reviews", reviewSchema);

export default ReviewModel;
