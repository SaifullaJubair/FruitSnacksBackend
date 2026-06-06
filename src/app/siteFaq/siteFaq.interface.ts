import { Types } from "mongoose";

export interface ISiteFaqInterface {
  _id?: Types.ObjectId;
  question: string;
  answer: string;
  order_no?: number;
  status: "active" | "inactive";
  _publisher_id?: Types.ObjectId;
  _updated_by?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export const siteFaqSearchableFields = ["question", "answer"];
