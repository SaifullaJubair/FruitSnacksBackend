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
      enum: ["active", "in-active"],
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
  },
  {
    timestamps: true,
  }
);

const ReviewModel = model<IReviewInterface>("reviews", reviewSchema);

export default ReviewModel;
