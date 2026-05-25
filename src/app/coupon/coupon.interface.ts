import { Types } from "mongoose";
import { IAdminInterface } from "../adminRegLog/admin.interface";
import { IProductInterface } from "../product/product.interface";
import { IUserInterface } from "../user/user.interface";

interface couponSpecificCustomerArray {
  customer_id?: Types.ObjectId | IUserInterface;
}

interface couponSpecificProductArray {
  product_id?: Types.ObjectId | IProductInterface;
}

export interface ICouponInterface {
  _id?: any;
  coupon_code: string;
  coupon_start_date: string;
  coupon_end_date: string;
  coupon_type: "fixed" | "percent" | "bogo";
  coupon_amount: number;
  coupon_use_per_person: number;
  coupon_use_total_person: number;
  coupon_available: number;
  coupon_status: "active" | "in-active";
  coupon_customer_type: "all" | "specific";
  coupon_specific_customer?: couponSpecificCustomerArray[];
  coupon_max_amount?: number;
  coupon_product_type: "all" | "specific";
  coupon_specific_product?: couponSpecificProductArray[];
  coupon_publisher_id?: Types.ObjectId | IAdminInterface;
  coupon_updated_by?: Types.ObjectId | IAdminInterface;
  // Phase E — BOGO ("buy X get Y free / Y at discount") config. Used only
  // when coupon_type === "bogo". Cart-side application is a future task;
  // backend only stores the rule here so the admin UI can author it now.
  bogo_buy_qty?: number; // e.g. 2 → "buy 2"
  bogo_get_qty?: number; // e.g. 1 → "get 1"
  bogo_get_discount_pct?: number; // 100 = free, 50 = half-price, ...
}

export const couponSearchableField = [
  "coupon_code",
  "coupon_status",
  "coupon_type",
  "coupon_start_date",
  "coupon_end_date",
  "coupon_customer_type",
  "coupon_product_type",
];
