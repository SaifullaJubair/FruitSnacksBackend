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
    forgot_otp: { type: Number },

    // ✅ OTP expiry — 10 minutes
    otp_expires_at: { type: Date },

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
