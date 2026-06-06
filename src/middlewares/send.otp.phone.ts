// src/middlewares/send.otp.phone.ts
import axios from "axios";
import { getSmsConfig } from "../app/setting/setting.services";
require("dotenv").config();

export const SendPhoneOTP = async (
  otp: number,
  number: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  user_name: string,
): Promise<boolean> => {
  try {
    // C12: single source of truth — settings DB first, .env fallback,
    // `sms_enabled === false` short-circuits to a silent no-op.
    const cfg = await getSmsConfig();
    if (!cfg) {
      // Either disabled by admin OR truly unconfigured. Log only the
      // unconfigured case so the disabled toggle stays quiet.
      console.warn("SendPhoneOTP: sms disabled or unconfigured — skipping");
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

    // C12 HIGH 4: https:// — matches order.sms.ts. Plain http leaks the
    // api_key + OTP code on the wire.
    const response = await axios.get(`https://bulksmsbd.net/api/smsapi`, {
      params: {
        api_key: cfg.apiKey,
        type: "text",
        number: formattedNumber,
        senderid: cfg.senderId,
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
