import { Schema, model } from "mongoose";
import { IQuestionInterface } from "./question.interface";

// Question Schema
const questionSchema = new Schema<IQuestionInterface>(
  {
    question_name: {
      type: String,
      required: true,
    },
    question_answer: {
      type: String,
    },
    question_status: {
      type: String,
      required: true,
      enum: ["active", "in-active"],
      default: "active",
    },
    question_product_id: {
      type: Schema.Types.ObjectId,
      ref: "products",
      required: true,
    },
    question_user_id: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    question_updated_by: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
  },
  {
    timestamps: true,
  }
);

const QuestionModel = model<IQuestionInterface>("questions", questionSchema);

export default QuestionModel;
