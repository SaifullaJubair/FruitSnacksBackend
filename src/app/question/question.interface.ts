import { Types } from "mongoose";
import { IProductInterface } from "../product/product.interface";
import { IAdminInterface } from "../adminRegLog/admin.interface";
import { IUserInterface } from "../user/user.interface";

export interface IQuestionInterface {
  _id?: any;
  question_name: string;
  question_answer?: string;
  question_status: "active" | "in-active";
  question_product_id: Types.ObjectId | IProductInterface;
  question_user_id: Types.ObjectId | IUserInterface;
  question_updated_by?: Types.ObjectId | IAdminInterface;
}

export const questionSearchableField = [
  "question_name",
  "question_answer",
  "question_status",
  "question_product_id",
  "question_user_id",
];
