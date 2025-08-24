import mongoose from "mongoose";
import { ICouponUsedInterface } from "./coupon.used.interface";
import CouponUsedModel from "./coupon.used.model";

// create a coupon used
export const createCouponUsedCustomer = async (
  data: ICouponUsedInterface,
  session: mongoose.ClientSession
): Promise<ICouponUsedInterface | any> => {
  const coupon = await CouponUsedModel.create([data], { session });
  return coupon;
};

// find a coupon by user id
export const getCouponUserByIdServices = async (
  coupon_id: string,
  customer_id: string
): Promise<ICouponUsedInterface | any> => {
  const coupon = await CouponUsedModel.findOne({
    coupon_id: coupon_id,
    customer_id: customer_id,
  });
  return coupon;
};
