import { Schema, model } from "mongoose";
import { IUserInterface } from "./user.interface";

const userSchema = new Schema<IUserInterface>(
  {
    user_password: { type: String },
    user_name: { type: String },
    user_phone: { type: String },
    user_image: { type: String },
    user_image_key: { type: String },
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
  },
  { timestamps: true },
);

const UserModel = model<IUserInterface>("users", userSchema);
export default UserModel;
