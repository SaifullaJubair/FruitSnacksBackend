import axios from "axios";
import { IAuthenticationInterface } from "../app/authentication/authentication.interface";
import AuthenticationModel from "../app/authentication/authentication.model";
require("dotenv").config();

export const SendPhoneOTP = async (
  otp: number | any,
  number: string | any,
  user_name: string
) => {
  try {
    const phoneCredentialsData: IAuthenticationInterface | any =
      await AuthenticationModel.find({});

    const phoneCredentials = phoneCredentialsData[0];
    const response = await axios.get(
      `https://sms.rapidsms.xyz/request.php?user_id=${phoneCredentials?.otp_phone_user}&password=${phoneCredentials?.otp_phone_password}&number=${number}&message=Hii,%20${user_name}%20${phoneCredentials?.otp_phone_body}%20<b><u>${otp}</u></b>`
    );
    if (response?.data?.status == "success") {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
};
