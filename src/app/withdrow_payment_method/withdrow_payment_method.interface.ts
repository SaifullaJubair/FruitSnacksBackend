import { Types } from "mongoose";
import { IAdminInterface } from "../adminRegLog/admin.interface";

export interface IPaymentMethodInterface {
  _id?: any;
  payment_method: string;
  minimum_withdrow_amount: number;
  payment_method_image: string;
  payment_method_image_key?: string;
  payment_method_status: "active" | "in-active";
  payment_method_publisher_id: Types.ObjectId | IAdminInterface;
}

export const paymentMethodSearchableField = [
  "payment_method",
  "payment_method_status",
];
