import { Types } from "mongoose";
import { ICouponInterface } from "../coupon.interface";
import { IUserInterface } from "../../user/user.interface";

export interface ICouponUsedInterface {
  _id?: any;
  coupon_id: Types.ObjectId | ICouponInterface;
  customer_id: Types.ObjectId | IUserInterface;
  used: number;
}
