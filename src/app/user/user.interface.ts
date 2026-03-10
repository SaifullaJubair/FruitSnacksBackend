export interface IUserInterface {
  _id?: any;
  user_password?: string;
  user_name?: string;
  user_phone: string;
  user_image?: string;
  user_image_key?: string;
  user_country?: string;
  user_division?: string;
  user_district?: string;
  user_address?: string;
  user_status?: "active" | "in-active";
  wallet_amount?: number;
  forgot_otp?: number;
  otp_expires_at?: Date; // ✅ OTP expiry
  user_type?: "guest" | "registered"; // ✅ guest or registered
  user_verified?: boolean; // ✅ password set করেছে কিনা
}

export const userSearchableField = [
  "user_name",
  "user_phone",
  "user_status",
  "user_address",
  "user_country",
  "user_division",
  "user_district",
  "user_type",
];
