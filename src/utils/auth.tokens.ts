/**
 * auth.tokens.ts — single source of truth for JWT sign/verify (Phase D, D1).
 *
 * WHY: login code used to live in two places (admin + user controllers), each
 * inlining `jwt.sign({ phone }, secret, { expiresIn: "365d" })`. That meant
 * (a) the phone-only payload forced every protected request to look the user
 * up by phone, (b) tokens lived a full year with no refresh + no revocation,
 * (c) any change had to be made twice and stay in sync. This module fixes all
 * three by being the only file that touches `jsonwebtoken`.
 *
 * Token shapes (kind = role separator so refresh can't be used as access):
 *   access  admin → { kind:"access",  who:"admin", _id, admin_phone, role_id }
 *   refresh admin → { kind:"refresh", who:"admin", _id, admin_phone }
 *   access  user  → { kind:"access",  who:"user",  _id, user_phone }
 *   refresh user  → { kind:"refresh", who:"user",  _id, user_phone }
 *
 * Lifetimes: admin access 7d (active operator), user access 30d (cart UX),
 * refresh 90d for both. Owner-locked stateless v1 — no DB persistence; all
 * three lifetimes change in this file and propagate.
 */

import { promisify } from "util";
const jwt = require("jsonwebtoken");

const SECRET = process.env.ACCESS_TOKEN;

export const TOKEN_LIFETIMES = {
  ADMIN_ACCESS: "7d",
  USER_ACCESS: "30d",
  REFRESH: "90d",
} as const;

// maxAge in ms — must match the JWT expiry so the cookie isn't longer-lived
// than the token it carries. Kept here so cookies + JWT can never drift.
export const COOKIE_MAX_AGE = {
  ADMIN_ACCESS_MS: 7 * 24 * 60 * 60 * 1000,
  USER_ACCESS_MS: 30 * 24 * 60 * 60 * 1000,
  REFRESH_MS: 90 * 24 * 60 * 60 * 1000,
} as const;

export const COOKIE_NAMES = {
  ACCESS: "fruit_snacks_token",
  REFRESH: "fruit_snacks_refresh",
} as const;

export type Who = "admin" | "user";
export type Kind = "access" | "refresh";

export interface AdminAccessPayload {
  kind: "access";
  who: "admin";
  _id: string;
  admin_phone: string;
  role_id?: string;
}
export interface AdminRefreshPayload {
  kind: "refresh";
  who: "admin";
  _id: string;
  admin_phone: string;
}
export interface UserAccessPayload {
  kind: "access";
  who: "user";
  _id: string;
  user_phone: string;
}
export interface UserRefreshPayload {
  kind: "refresh";
  who: "user";
  _id: string;
  user_phone: string;
}

export type AnyPayload =
  | AdminAccessPayload
  | AdminRefreshPayload
  | UserAccessPayload
  | UserRefreshPayload;

// ── sign ────────────────────────────────────────────────────────────────────
export const signAdminAccess = (p: Omit<AdminAccessPayload, "kind" | "who">) =>
  jwt.sign({ kind: "access", who: "admin", ...p }, SECRET, {
    expiresIn: TOKEN_LIFETIMES.ADMIN_ACCESS,
  });

export const signAdminRefresh = (
  p: Omit<AdminRefreshPayload, "kind" | "who">,
) =>
  jwt.sign({ kind: "refresh", who: "admin", ...p }, SECRET, {
    expiresIn: TOKEN_LIFETIMES.REFRESH,
  });

export const signUserAccess = (p: Omit<UserAccessPayload, "kind" | "who">) =>
  jwt.sign({ kind: "access", who: "user", ...p }, SECRET, {
    expiresIn: TOKEN_LIFETIMES.USER_ACCESS,
  });

export const signUserRefresh = (p: Omit<UserRefreshPayload, "kind" | "who">) =>
  jwt.sign({ kind: "refresh", who: "user", ...p }, SECRET, {
    expiresIn: TOKEN_LIFETIMES.REFRESH,
  });

// ── verify ──────────────────────────────────────────────────────────────────
export const verifyTokenAsync = async (token: string): Promise<AnyPayload> =>
  promisify(jwt.verify)(token, SECRET) as any;

// ── cookie shape (kept centralized so every set/clear is identical) ─────────
type ResLike = {
  cookie: (name: string, val: string, opts: any) => void;
  clearCookie: (name: string, opts?: any) => void;
};

// Cookie cross-site policy must differ by environment:
//  - production: the admin/storefront/API live on separate subdomains, so the
//    cookie has to be sent cross-site → `sameSite:"none"` which REQUIRES
//    `secure:true` (HTTPS only).
//  - local dev: there is no HTTPS, and `secure:true` makes the browser silently
//    DROP the cookie over http://localhost → login appears to work but getMe is
//    always 401. localhost:3000↔localhost:5000 are the same site (host
//    `localhost`), so `sameSite:"lax"` + `secure:false` lets the cookie stick.
// Toggled off NODE_ENV so V1 and V2 dev both work without HTTPS.
const isProd = process.env.NODE_ENV === "production";
const baseCookieOpts = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
};

export const setAccessCookie = (res: ResLike, who: Who, token: string) => {
  res.cookie(COOKIE_NAMES.ACCESS, token, {
    ...baseCookieOpts,
    maxAge:
      who === "admin"
        ? COOKIE_MAX_AGE.ADMIN_ACCESS_MS
        : COOKIE_MAX_AGE.USER_ACCESS_MS,
  });
};

export const setRefreshCookie = (res: ResLike, token: string) => {
  res.cookie(COOKIE_NAMES.REFRESH, token, {
    ...baseCookieOpts,
    maxAge: COOKIE_MAX_AGE.REFRESH_MS,
  });
};

export const clearAuthCookies = (res: ResLike) => {
  res.clearCookie(COOKIE_NAMES.ACCESS, baseCookieOpts);
  res.clearCookie(COOKIE_NAMES.REFRESH, baseCookieOpts);
};
