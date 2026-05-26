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
  // Phase D: bcrypt hash of 6-digit OTP (was raw 4-digit number).
  forgot_otp?: string | number;
  otp_expires_at?: Date;
  otp_sent_at?: Date;
  otp_attempts?: number;
  user_type?: "guest" | "registered";
  user_verified?: boolean;

  // Phase H — pricing tier this user belongs to. Resolver picks the matching
  // `group_prices` entry on a product when this is not "retail".
  customer_group?: "retail" | "wholesale" | "vip";

  // Phase G3 — loyalty points balance (separate from wallet_amount currency).
  loyalty_points?: number;
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
