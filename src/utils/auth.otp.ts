/**
 * auth.otp.ts — central OTP helpers (Phase D, D3).
 *
 * WHY: before this module the codebase generated a 4-digit OTP with
 * `Math.floor(1000 + random*9000)` and stored it raw in `forgot_otp` (a
 * Number). 10000 combinations + no rate-limit + plaintext = trivially
 * brute-forceable / leakable via DB read. This file is the only place OTPs are
 * minted or compared so all three flows (user forgot, user resend, admin
 * forgot in D4) get the same hardening for free.
 *
 * Decisions: 6 digits (10× harder to guess), bcrypt-hashed at rest, 10-min
 * expiry (unchanged), 60-second cool-down between sends per account, 5-attempt
 * cap before forcing a fresh request. Backwards-compatible: `verifyOtp`
 * detects old raw numeric values and accepts them once so existing OTPs in
 * flight don't break the rollout.
 */

const bcrypt = require("bcryptjs");

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute
export const OTP_MAX_ATTEMPTS = 5;

/** Random 6-digit code as a string (preserves leading zeros). */
export const generateOtp = (): string => {
  let s = "";
  for (let i = 0; i < OTP_LENGTH; i++) {
    s += Math.floor(Math.random() * 10).toString();
  }
  return s;
};

/** Bcrypt-hash the OTP for at-rest storage. */
export const hashOtp = async (otp: string): Promise<string> =>
  bcrypt.hash(String(otp), 10);

/**
 * Constant-time compare of submitted OTP against stored value. Accepts both
 * new bcrypt-hash strings AND old raw Number values (back-compat during the
 * rollout — the next send replaces the legacy raw with a hash).
 */
export const verifyOtp = async (
  submitted: string | number,
  stored: string | number | null | undefined,
): Promise<boolean> => {
  if (stored === null || stored === undefined) return false;
  const sub = String(submitted);
  const sto = String(stored);
  // bcrypt hashes always start with "$2" (e.g. "$2a$", "$2b$").
  if (sto.startsWith("$2")) return bcrypt.compare(sub, sto);
  // Legacy raw value (pre-Phase-D OTPs still alive in DB).
  return sub === sto;
};

/** True if `otp_sent_at` is recent enough that a resend should be blocked. */
export const isWithinSendCooldown = (
  otpSentAt: Date | string | null | undefined,
): boolean => {
  if (!otpSentAt) return false;
  const last = new Date(otpSentAt).getTime();
  return Date.now() - last < OTP_RESEND_COOLDOWN_MS;
};

/** Seconds the caller must wait before requesting another OTP. */
export const secondsUntilCooldownEnds = (
  otpSentAt: Date | string | null | undefined,
): number => {
  if (!otpSentAt) return 0;
  const last = new Date(otpSentAt).getTime();
  const elapsed = Date.now() - last;
  return Math.max(0, Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000));
};

/** Convenience — the doc fields a "send OTP" flow should write. */
export const buildOtpFields = async (otp: string) => ({
  forgot_otp: await hashOtp(otp),
  otp_expires_at: new Date(Date.now() + OTP_TTL_MS),
  otp_sent_at: new Date(),
  otp_attempts: 0,
});

/** Convenience — the unset block a successful-verify flow should write. */
export const otpClearFields = () => ({
  forgot_otp: null,
  otp_expires_at: null,
  otp_sent_at: null,
  otp_attempts: 0,
});
