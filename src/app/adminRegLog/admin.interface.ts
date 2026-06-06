import { Types } from "mongoose";
import { IRoleInterface } from "../role/role.interface";

export interface IAdminInterface {
  _id?: any;
  admin_password?: string;
  admin_name?: string;
  admin_phone: string;
  user_logo?: string;
  user_logo_key?: string;
  admin_country?: string;
  admin_division?: string;
  admin_district?: string;
  admin_address?: string;
  admin_status?: "active" | "in-active";
  role_id: Types.ObjectId | IRoleInterface;
  admin_publisher_id?: Types.ObjectId | IAdminInterface;
  admin_updated_by?: Types.ObjectId | IAdminInterface;
  // Phase D — admin self password-reset (same OTP shape as user).
  forgot_otp?: string;
  otp_expires_at?: Date;
  otp_sent_at?: Date;
  otp_attempts?: number;
  // H-B — email channel for password reset
  admin_email?: string;
}

export const adminSearchableField = [
  "admin_name",
  "admin_phone",
  "admin_status",
  "admin_address",
  "admin_country",
  "admin_division",
  "admin_district",
];
