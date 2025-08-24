
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
}

export const userSearchableField = [
  "user_name",
  "user_phone",
  "user_status",
  "user_address",
  "user_country",
  "user_division",
  "user_district",
];
