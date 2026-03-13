// src/utils/send.order.sms.ts

import axios from "axios";

const SITE_URL = "https://artisenleather.com";
const BULKSMS_API_KEY = process.env.BULKSMS_API_KEY!;
const BULKSMS_SENDER_ID = process.env.BULKSMS_SENDER_ID!;

// Format phone: +8801799607660 → 8801799607660 (remove +)
// 01799607660 → 8801799607660 (add 880)
const formatPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("0")) return "880" + digits.slice(1);
  return "880" + digits;
};

// Phone for URL: 8801799607660 → 01799607660
const phoneForURL = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("880")) return "0" + digits.slice(3);
  if (digits.startsWith("0")) return digits;
  return "0" + digits;
};

const sendSMS = async (phone: string, message: string): Promise<void> => {
  try {
    const to = formatPhone(phone);
    await axios.post(
      "https://bulksmsbd.net/api/smsapi",
      {
        api_key: BULKSMS_API_KEY,
        senderid: BULKSMS_SENDER_ID,
        number: to,
        message,
      },
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("SMS send failed:", err);
    // Don't throw — SMS failure shouldn't break order flow
  }
};

// ── Case 1: Fresh guest OR returning unverified guest ─────────────────────────
// user_created=true (1st order) OR user_verified=false (repeat unverified order)
export const sendOrderSMS_GuestUnverified = async (
  phone: string,
  invoice_id: string,
): Promise<void> => {
  const urlPhone = phoneForURL(phone);
  const message =
    `Artisan Leather:\n` +
    `Thanks for your order! Invoice: ${invoice_id}.\n` +
    `Your account is ready.\n` +
    `Set your password:\n` +
    `${SITE_URL}/set-password?phone=${urlPhone}`;
  await sendSMS(phone, message);
};

// ── Case 2: Verified guest (has password) but NOT logged in ───────────────────
export const sendOrderSMS_VerifiedGuest = async (
  phone: string,
  invoice_id: string,
  tracking_id: string,
): Promise<void> => {
  const message =
    `Artisan Leather:\n` +
    `Thanks for your order! Invoice: ${invoice_id}.\n` +
    `Track your order:\n` +
    `${SITE_URL}/orders/order-tracking/${tracking_id}`;
  await sendSMS(phone, message);
};

// ── Case 3: Verified + Logged-in user ─────────────────────────────────────────
export const sendOrderSMS_LoggedIn = async (
  phone: string,
  invoice_id: string,
): Promise<void> => {
  const message =
    `Artisan Leather:\n` +
    `Thanks for your order! Invoice: ${invoice_id}.\n` +
    `Check order history:\n` +
    `${SITE_URL}/user-profile?tab=purchase-history`;
  await sendSMS(phone, message);
};
