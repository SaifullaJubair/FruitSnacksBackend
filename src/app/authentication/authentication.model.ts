import { Schema, model } from "mongoose";
import { IAuthenticationInterface } from "./authentication.interface";

// authentication Schema
const authenticationSchema = new Schema<IAuthenticationInterface>(
  {
    otp_phone_user: {
      type: String,
    },
    otp_phone_password: {
      type: String,
    },
    otp_phone_body: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const AuthenticationModel = model<IAuthenticationInterface>("authentication", authenticationSchema);

export default AuthenticationModel;
