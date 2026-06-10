/**
 * rate.limit.ts — per-IP rate limiters (F002).
 *
 * WHY: backend had zero throttling. Login/OTP/signup/order/review were all
 * brute-forceable from a single IP. OTP doc had a per-doc 5-attempt cap but
 * attacker could spam new OTP sends (= SMS cost + DoS). These limiters slot
 * onto specific routes; index.ts also calls `app.set("trust proxy", 1)` so
 * req.ip reflects the real client through Coolify's reverse proxy.
 *
 * Store: in-memory (default). Resets on container restart — acceptable for
 * clone-per-client single-container model. Switch to rate-limit-redis if we
 * move to multi-instance / SaaS.
 *
 * Tuning: limits are conservative defaults. Loosen if real users get blocked,
 * tighten if abuse observed in logs.
 */

import rateLimit from "express-rate-limit";

const json429 = (msg: string) => ({ success: false, message: msg });

// Strict — login, password reset, OTP verify (brute-force targets)
// Owner-tuned 2026-06-03: 20 attempts / 10 min window.
export const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Too many attempts. Try again in 10 minutes."),
});

// SMS-triggering — forgot password, resend OTP (cost + spam control).
// Owner-tuned 2026-06-03: dual limit — 5 per hour AND 30 per day. Chain both
// on the same route so either cap triggers 429. Hourly catches bursts; daily
// catches slow-drip SMS budget drain.
export const otpSendHourlyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Too many OTP requests. Try again in 1 hour."),
});

export const otpSendDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hour
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Daily OTP limit reached. Try again tomorrow."),
});

// Signup — bot account prevention. Owner-tuned 2026-06-03: 20 / hour.
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Too many signup attempts. Try again in 1 hour."),
});

// Order placement — burst spam control (generous for legitimate retry).
export const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Order rate limit reached. Try again shortly."),
});

// Review submission — spam control.
export const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Too many reviews submitted. Try again later."),
});

// Newsletter subscribe — public endpoint, bot/spam control.
export const newsletterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Too many subscription attempts. Try again later."),
});
