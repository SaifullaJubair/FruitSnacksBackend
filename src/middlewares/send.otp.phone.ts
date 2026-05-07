// src/middlewares/send.otp.phone.ts
import axios from "axios";
require("dotenv").config();

export const SendPhoneOTP = async (
  otp: number,
  number: string,
  user_name: string,
): Promise<boolean> => {
  try {
    const apiKey = process.env.BULKSMS_API_KEY;
    const senderId = process.env.BULKSMS_SENDER_ID;

    if (!apiKey || !senderId) {
      console.warn(
        "BulkSMS: BULKSMS_API_KEY or BULKSMS_SENDER_ID not set in .env",
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
