/**
 * phone.ts — Bangladesh phone normalization (B1, 2026-06-04).
 *
 * WHY: callers send the same phone in many shapes — "01711-123456",
 * "01711123456", "+8801711123456", "8801711123456". A raw `findOne` lookup
 * by `user_phone` therefore can't reconcile them and we end up with
 * duplicate accounts (the audit memo proposes a backfill script too).
 * This helper boils everything down to E.164 BD: +8801XXXXXXXXX (14 chars).
 *
 * Conservative philosophy: if the input doesn't look like a recognizable BD
 * mobile number, return it trimmed but unchanged so we never corrupt foreign
 * numbers in clone deployments (Bengali shop running on this stack in a
 * different country). Only known BD shapes get rewritten.
 */

const BD_OPERATOR_PREFIXES = ["13", "14", "15", "16", "17", "18", "19"];

/**
 * Strip every non-digit character. Returns a digits-only string.
 * Used as a normalisation step before pattern-matching.
 */
const digitsOnly = (s: string): string => s.replace(/\D+/g, "");

/**
 * Convert any BD mobile shape to E.164 (`+8801XXXXXXXXX`, 14 chars).
 * Inputs that don't look like a BD mobile number are returned trimmed but
 * otherwise unchanged so non-BD deployments don't get garbled phones.
 *
 *   "+8801711123456" → "+8801711123456"
 *   "8801711123456"  → "+8801711123456"
 *   "01711123456"    → "+8801711123456"
 *   "01711-123456"   → "+8801711123456"
 *   "1711123456"     → "+8801711123456"
 *   "+11234567890"   → "+11234567890" (foreign — left alone, just trimmed)
 */
export const normalizeBdPhone = (input: string | null | undefined): string => {
  if (!input) return "";
  const trimmed = String(input).trim();
  if (!trimmed) return "";

  const digits = digitsOnly(trimmed);

  // 13-digit "8801XXXXXXXXX" → prepend "+"
  if (digits.length === 13 && digits.startsWith("880")) {
    const op = digits.substring(3, 5);
    if (BD_OPERATOR_PREFIXES.includes(op)) {
      return `+${digits}`;
    }
  }
  // 11-digit "01XXXXXXXXX" → prepend "+880"
  if (digits.length === 11 && digits.startsWith("0")) {
    const op = digits.substring(1, 3);
    if (BD_OPERATOR_PREFIXES.includes(op)) {
      return `+880${digits.substring(1)}`;
    }
  }
  // 10-digit "1XXXXXXXXX" (no leading 0, no country code) → prepend "+880"
  if (digits.length === 10 && digits.startsWith("1")) {
    const op = digits.substring(0, 2);
    if (BD_OPERATOR_PREFIXES.includes(op)) {
      return `+880${digits}`;
    }
  }
  // Doesn't match BD mobile patterns — return the trimmed original. Callers
  // can still find legacy data, and foreign phones in clones aren't broken.
  return trimmed;
};

/**
 * True if `input` parses as a recognisable BD mobile number.
 */
export const isBdMobile = (input: string | null | undefined): boolean => {
  if (!input) return false;
  const digits = digitsOnly(String(input));
  if (digits.length === 13 && digits.startsWith("880")) {
    return BD_OPERATOR_PREFIXES.includes(digits.substring(3, 5));
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return BD_OPERATOR_PREFIXES.includes(digits.substring(1, 3));
  }
  if (digits.length === 10 && digits.startsWith("1")) {
    return BD_OPERATOR_PREFIXES.includes(digits.substring(0, 2));
  }
  return false;
};
