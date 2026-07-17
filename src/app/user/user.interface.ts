export interface IUserInterface {
  _id?: any;
  user_password?: string;
  user_name?: string;
  user_phone: string;
  // S4+S5 Phase 1C (2026-06-05) — optional. Bangladesh storefront stays
  // phone-OTP first; email is collected opportunistically from Profile
  // Setting page, post-order prompt, or sign-up form. Used by Meta/TikTok
  // CAPI for the `em` Advanced Matching field → ~30% EMQ boost where set.
  // Unique-sparse index allows many rows with no email.
  user_email?: string;
  user_image?: string;
  user_image_key?: string;
  user_additional_phone?: string;
  user_gender?: "male" | "female" | "other";
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

  // S6 (2026-06-04) — saved shipping addresses. Embedded array on the user
  // doc (single-shop scale; per-tenant in future SaaS migration). Exactly
  // one entry has is_default=true; backend enforces this invariant on every
  // mutation. Orders snapshot delivery info at place-time so deleting an
  // address here never breaks past order history.
  addresses?: IUserAddress[];
}

export interface IUserAddress {
  _id?: any;
  label?: string;
  recipient_name?: string;
  recipient_phone?: string;
  division?: string;
  district?: string;
  address_line?: string;
  is_default?: boolean;
}

// SECURITY: the ONLY fields safe to return to a client for a customer. An
// allow-list (fails closed), so user_password / forgot_otp / otp_* can never
// leak — including through a .populate() on another module (review/question),
// where .select() on the parent does NOT reach the joined user doc. Ported from
// core 2026-07-17 (the staff-list hash-leak class, recurring in user paths).
export const USER_PUBLIC_PROJECTION =
  "user_name user_phone user_email user_image user_division user_district user_status status_changed_at user_type customer_group createdAt";

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
