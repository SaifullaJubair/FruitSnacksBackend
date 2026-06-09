import { Schema, model } from "mongoose";
import { IUserInterface } from "./user.interface";

const userSchema = new Schema<IUserInterface>(
  {
    user_password: { type: String },
    user_name: { type: String },
    user_phone: { type: String },
    // S4+S5 Phase 1C — optional. unique-sparse so many rows can have
    // no email (BD storefront is phone-OTP first), but real values
    // must be unique. lowercase+trim so case/whitespace can't bypass.
    user_email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true,
    },
    user_image: { type: String },
    user_image_key: { type: String },
    user_additional_phone: { type: String },
    user_gender: { type: String, enum: ["male", "female", "other"] },
    user_country: { type: String, default: "Bangladesh" },
    user_district: { type: String },
    user_division: { type: String },
    user_address: { type: String },
    user_status: {
      type: String,
      enum: ["active", "in-active"],
      default: "active",
    },
    wallet_amount: { type: Number, default: 0 },
    // Phase D: now stores a bcrypt HASH of the 6-digit OTP (was raw 4-digit
    // Number). Schema is String so old number values are still readable during
    // rollout; the new flow always writes hashes and the verify-helper
    // detects hash vs. raw and rejects appropriately.
    forgot_otp: { type: String },
    otp_expires_at: { type: Date },
    // Phase D: rate-limit + attempt cap to stop OTP brute-force.
    otp_sent_at: { type: Date },
    otp_attempts: { type: Number, default: 0 },

    // ✅ User type & verified status
    user_type: {
      type: String,
      enum: ["guest", "registered"],
      default: "guest",
    },
    user_verified: { type: Boolean, default: false },

    // Phase H — pricing tier this user belongs to.
    customer_group: {
      type: String,
      enum: ["retail", "wholesale", "vip"],
      default: "retail",
    },

    // Phase G3 — loyalty points balance.
    loyalty_points: { type: Number, default: 0 },

    // S6 (2026-06-04) — saved shipping addresses. See IUserAddress in the
    // interface for field semantics. Backend enforces exactly-one default
    // on every mutation; deleting the default promotes the first remaining
    // address. Existing docs without this field still work via the default.
    addresses: {
      type: [
        new Schema(
          {
            label: { type: String, maxlength: 50 },
            recipient_name: { type: String, maxlength: 100 },
            recipient_phone: { type: String, maxlength: 20 },
            division: { type: String, maxlength: 100 },
            district: { type: String, maxlength: 100 },
            // Cap matches Pathao's billing-address limit so we don't queue
            // an order at place-time that the courier rejects.
            address_line: { type: String, maxlength: 250 },
            is_default: { type: Boolean, default: false },
          },
          { timestamps: true, _id: true },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);

const UserModel = model<IUserInterface>("users", userSchema);
export default UserModel;
