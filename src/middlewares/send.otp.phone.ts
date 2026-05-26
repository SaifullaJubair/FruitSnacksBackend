// src/middlewares/send.otp.phone.ts
import axios from "axios";
import SettingModel from "../app/setting/setting.model";
require("dotenv").config();

export const SendPhoneOTP = async (
  otp: number,
  number: string,
  user_name: string,
): Promise<boolean> => {
  try {
    // Phase G5 — prefer settings (admin-editable, no redeploy needed); fall
    // back to .env for legacy deployments. Settings also carries an enabled
    // toggle so admin can switch SMS off without unsetting credentials.
    const setting: any = await SettingModel.findOne({})
      .select("sms_enabled sms_api_key sms_sender_id")
      .lean()
      .catch(() => null);

    if (setting && setting.sms_enabled === false) {
      return false;
    }

    const apiKey =
      (setting && setting.sms_api_key) || process.env.BULKSMS_API_KEY;
    const senderId =
      (setting && setting.sms_sender_id) || process.env.BULKSMS_SENDER_ID;

    if (!apiKey || !senderId) {
      console.warn(
        "BulkSMS: api key / sender id missing (settings + .env both empty)",
      );
      return false;
    }

    // BulkSMS BD format — OTP message
    const message = `FruitSnacks: Your OTP is ${otp}. Valid for 10 mins. For security, do not share this code with anyone.`;
    // number format: 8801XXXXXXXXX
    const formattedNumber = number.startsWith("+")
      ? number.replace("+", "")
      : number.startsWith("88")
        ? number
        : `88${number}`;

    const response = await axios.get(`http://bulksmsbd.net/api/smsapi`, {
      params: {
        api_key: apiKey,
        type: "text",
        number: formattedNumber,
        senderid: senderId,
        message: message,
      },
    });

    // BulkSMS success code = 202
    if (response?.data?.response_code === 202) {
      return true;
    } else {
      console.error("BulkSMS error:", response?.data);
      return false;
    }
  } catch (error: any) {
    console.error("SendPhoneOTP error:", error?.message);
    return false;
  }
};
