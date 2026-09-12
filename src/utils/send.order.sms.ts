// src/utils/send.order.sms.ts
import axios from "axios";
import {
  getSmsConfig,
  getStorefrontBaseUrl,
} from "../app/setting/setting.services";

const SITE_TITLE = process.env.SITE_TITLE || "FruitSnacks";

// +8801799607660 → 8801799607660
const formatPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("0")) return "880" + digits.slice(1);
  return "880" + digits;
};

// 8801799607660 → 01799607660 (for URL)
const phoneForURL = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("880")) return "0" + digits.slice(3);
  if (digits.startsWith("0")) return digits;
  return "0" + digits;
};

const sendSMS = async (phone: string, message: string): Promise<void> => {
  try {
    // C12: single source of truth — getSmsConfig() returns null when admin
    // toggled SMS off OR when api_key / sender_id missing in DB + .env both.
    const cfg = await getSmsConfig();
    if (!cfg) return;

    const response = await axios.post(
      "https://bulksmsbd.net/api/smsapi",
      {
        api_key: cfg.apiKey,
        senderid: cfg.senderId,
        number: formatPhone(phone),
        message,
      },
      { headers: { "Content-Type": "application/json" } },
    );

    // BulkSMS answers 200 OK even when it refuses the message — an expired
    // balance validity, a bad sender id and an unknown number all come back as
    // a 200 carrying response_code 1006 / 1011 / … . Awaiting the call without
    // reading the body therefore logged NOTHING on failure, and an operator
    // watching the logs saw a silent success while no SMS ever left. The OTP
    // sender has always checked this; the order sender never did.
    const code = response?.data?.response_code;
    if (code !== 202) {
      console.error("Order SMS rejected by provider:", {
        response_code: code,
        error_message: response?.data?.error_message,
        invoice_hint: message.split("\n")[1],
      });
    }
  } catch (err) {
    console.error("SMS send failed:", err);
  }
};

// ── Case 1: Fresh guest OR returning unverified guest ─────────────────────────
export const sendOrderSMS_GuestUnverified = async (
  phone: string,
  invoice_id: string,
): Promise<void> => {
  const baseUrl = await getStorefrontBaseUrl();
  const message =
    `${SITE_TITLE}: Thanks for your order!\n` +
    `Invoice: ${invoice_id}\n` +
    // `Your account is ready.\n` +
    `Set a password to view your orders:\n` +
    `${baseUrl}/set-password?phone=${phoneForURL(phone)}`;
  await sendSMS(phone, message);
};

// ── Case 2: Verified guest but NOT logged in ──────────────────────────────────
export const sendOrderSMS_VerifiedGuest = async (
  phone: string,
  invoice_id: string,
  tracking_id: string,
): Promise<void> => {
  const baseUrl = await getStorefrontBaseUrl();
  const message =
    `${SITE_TITLE}: Thanks for your order!\n` +
    `Invoice: ${invoice_id}\n` +
    `Track your order:\n` +
    `${baseUrl}/orders/order-tracking/${tracking_id}`;
  await sendSMS(phone, message);
};

// ── Case 3: Verified + Logged-in user ────────────────────────────────────────
// CURRENTLY UNUSED. The confirm handler can't tell a logged-in customer from a
// logged-out one (the `is_guest` flag it used to branch on exists in no schema),
// and this link lands on /user-profile, which redirects anyone without a live
// session to the login page. Verified customers now get the tracking link
// above, which works either way. Kept for the day a real session signal exists.
export const sendOrderSMS_LoggedIn = async (
  phone: string,
  invoice_id: string,
): Promise<void> => {
  const baseUrl = await getStorefrontBaseUrl();
  const message =
    `${SITE_TITLE}: Thanks for your order!\n` +
    `Invoice: ${invoice_id}\n` +
    `Check order history:\n` +
    `${baseUrl}/user-profile?tab=purchase-history`;
  await sendSMS(phone, message);
};
