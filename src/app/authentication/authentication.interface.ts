
export interface IAuthenticationInterface {
  _id?: any;
  otp_phone_user?: string;
  otp_phone_password?: string;
  otp_phone_body?: string;
}

export const authenticationSearchableField = [
  "otp_phone_user",
  "otp_phone_password",
  "otp_phone_body"
]
