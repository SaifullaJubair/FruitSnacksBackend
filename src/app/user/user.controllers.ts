import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import sendResponse from "../../shared/sendResponse";
import { IUserInterface, userSearchableField } from "./user.interface";
import {
  countDashboardUserServices,
  deleteUserServices,
  findAllDashboardUserServices,
  postUserServices,
  updateforgotPasswordUsersChangeNewPasswordService,
  updateLogUsersNewOTPService,
  updateUserOTPServices,
  updateUserServices,
} from "./user.services";
import UserModel from "./user.model";
import { SendPhoneOTP } from "../../middlewares/send.otp.phone";
import OrderModel from "../order/order.model";
import OrderProductModel from "../orderProducts/orderProduct.model";
import { sendMetaEvent } from "../metaPixel/meta.pixel.service";
import {
  signUserAccess,
  signUserRefresh,
  setAccessCookie,
  setRefreshCookie,
  clearAuthCookies,
} from "../../utils/auth.tokens";
import {
  generateOtp,
  buildOtpFields,
  verifyOtp,
  isWithinSendCooldown,
  secondsUntilCooldownEnds,
  otpClearFields,
  OTP_MAX_ATTEMPTS,
} from "../../utils/auth.otp";
import { normalizeBdPhone } from "../../utils/phone";
const bcrypt = require("bcryptjs");
const saltRounds = 10;
const jwt = require("jsonwebtoken");

// ── Add A User (Signup) ────────────────────────────────────────────────────────
export const postUser: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<IUserInterface | any> => {
  try {
    const requestData = req.body;

    if (!requestData?.user_name)
      throw new ApiError(400, "User Name Required !");
    if (!requestData?.user_password)
      throw new ApiError(400, "Password Required !");
    if (!requestData?.user_phone)
      throw new ApiError(400, "User Phone Required !");

    const existingUser = await UserModel.findOne({
      user_phone: requestData?.user_phone,
    });

    if (existingUser && existingUser?.user_password) {
      throw new ApiError(400, "Already Added This Phone Please Login !");
    }

    const hashedPassword = await bcrypt.hash(
      requestData?.user_password,
      saltRounds,
    );
    delete requestData?.user_password;

    if (existingUser) {
      // Guest user → password set করছে
      // Phase 1C — also save optional email if buyer typed one in
      // the sign-up form and the existing guest record has none.
      const optionalEmail = (requestData?.user_email || "")
        .toString()
        .trim()
        .toLowerCase();
      const updateFields: any = {
        user_password: hashedPassword,
        user_verified: true, // ✅
        user_type: "registered", // ✅
      };
      if (optionalEmail && !existingUser.user_email) {
        updateFields.user_email = optionalEmail;
      }
      const updateResult = await UserModel.updateOne(
        { user_phone: requestData?.user_phone },
        updateFields,
        { runValidators: true },
      );
      if (updateResult.modifiedCount > 0) {
        return sendResponse(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Signup Successfully !",
        });
      } else {
        throw new ApiError(400, "User Update Failed !");
      }
    } else {
      // Phase 1C — lowercase the optional email before persisting so
      // the unique-sparse index sees consistent values.
      const optionalEmail = (requestData?.user_email || "")
        .toString()
        .trim()
        .toLowerCase();
      const newUser = await postUserServices({
        ...requestData,
        user_email: optionalEmail || undefined,
        user_password: hashedPassword,
        user_verified: true, // ✅ normal signup = verified
        user_type: "registered", // ✅
      });
      if (newUser) {
        return sendResponse(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Signup Successfully !",
        });
      } else {
        throw new ApiError(400, "User Creation Failed !");
      }
    }
  } catch (error: any) {
    // Phase 1C — friendly message on duplicate email collision.
    // Catches both the create path (postUserServices) and the
    // existing-guest update path (UserModel.updateOne). Mongo error
    // shape varies a little between driver versions — match either
    // keyPattern or errmsg substring.
    const isDupEmail =
      error?.code === 11000 &&
      (error?.keyPattern?.user_email ||
        String(error?.errmsg || error?.message || "").includes("user_email"));
    if (isDupEmail) {
      return next(
        new ApiError(409, "This email is already linked to another account."),
      );
    }
    next(error);
  }
};

// login a user
export const postLogUser: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { user_password, user_phone: rawPhone } = req.body;

    if (!user_password || !rawPhone)
      throw new ApiError(400, "Phone and Password are required.");

    // B1 (2026-06-04) — normalize then try BOTH the normalized phone AND the
    // original. Legacy data in the DB may still be saved in a non-canonical
    // shape; the backfill script will rewrite it but until then we look up
    // either way so existing accounts keep working.
    const user_phone = normalizeBdPhone(rawPhone);
    const findUser: any = await UserModel.findOne({
      $or: [{ user_phone }, { user_phone: rawPhone }],
    });
    if (!findUser) throw new ApiError(400, "User not found.");
    if (findUser.user_status === "in-active")
      throw new ApiError(400, "Invalid User!");

    // B1/D3 (2026-06-04) — security fix. The previous behaviour silently set
    // whatever the caller typed as the account password when `user_password`
    // was empty in the DB (the typical state for guest-order auto-created
    // users via `findOrCreateUser`). Anyone who knew the victim's phone
    // number could own that account by hitting `/login` once with any
    // password string.
    //
    // Anonymous checkout is NOT affected — guest-order placement still
    // creates the user with an empty password as it always did. What
    // changed: the first time that user wants to SIGN IN, they must go
    // through the OTP-gated set-password flow (`/forgetPassword` →
    // `/verifyOTP` → `/setNewPassword`).
    if (!findUser.user_password) {
      throw new ApiError(
        400,
        "Account exists but no password set. Please use 'Forgot Password' to set one via OTP.",
      );
    }
    const isPasswordValid = await bcrypt.compare(
      user_password,
      findUser.user_password,
    );
    if (!isPasswordValid) throw new ApiError(400, "Password does not match!");

    // Phase D: token now carries _id (skip per-request phone lookup).
    // Access 30d (cart UX) + 90d refresh — see utils/auth.tokens.
    // B1: token-stored phone = whatever's on the actual user doc (could be
    // legacy raw shape pending backfill, never the inbound `rawPhone`).
    const _id = String(findUser._id);
    const tokenPhone = findUser.user_phone || user_phone;
    const access = signUserAccess({ _id, user_phone: tokenPhone });
    const refresh = signUserRefresh({ _id, user_phone: tokenPhone });
    setAccessCookie(res, "user", access);
    setRefreshCookie(res, refresh);

    // Meta CAPI Login event
    try {
      const clientIp =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        "";
      await sendMetaEvent({
        event_name: "Login",
        event_id: req.body?.login_event_id || `login-${Date.now()}`,
        action_source: "website",
        user_data: {
          ph: user_phone,
          external_id: findUser?._id?.toString(),
          client_ip_address: clientIp,
          client_user_agent: req.headers["user-agent"] || "",
          fbc: req.body?.fbc,
          fbp: req.body?.fbp,
        },
      });
    } catch (e) {}

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Sign in Successfully!",
    });
  } catch (error) {
    next(error);
  }
};

// ── Check User ────────────────────────────────────────────

export const checkUserPhone: RequestHandler = async (req, res, next) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      throw new ApiError(400, "Phone number required!");
    }

    // B1 (2026-06-04) — normalize + dual-lookup so legacy data still
    // resolves until the backfill script runs.
    const phoneStr = String(phone);
    const normalized = normalizeBdPhone(phoneStr);
    const findUser: any = await UserModel.findOne({
      $or: [{ user_phone: normalized }, { user_phone: phoneStr }],
    });

    if (!findUser) {
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "User not found",
        data: { exists: false, verified: false },
      });
    }

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "User found",
      data: {
        exists: true,
        verified: findUser?.user_verified === true,
        has_password: !!findUser?.user_password,
      },
    });
  } catch (error) {
    next(error);
  }
};


//  ── Verify OTP (Phase D: bcrypt + attempt cap) ─────────────────────────────
export const verifyUserOTP: RequestHandler = async (req, res, next) => {
  try {
    const { user_phone, user_otp } = req.body;

    if (!user_phone || !user_otp) {
      throw new ApiError(400, "Phone and OTP required!");
    }

    const findUser: any = await UserModel.findOne({ user_phone });
    if (!findUser) throw new ApiError(400, "User not found!");

    if (findUser?.otp_expires_at && new Date() > new Date(findUser.otp_expires_at)) {
      throw new ApiError(400, "OTP has expired. Please request a new one.");
    }

    if ((findUser.otp_attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
      throw new ApiError(
        429,
        "Too many wrong attempts. Please request a new OTP.",
      );
    }

    const ok = await verifyOtp(user_otp, findUser.forgot_otp);
    if (!ok) {
      await UserModel.updateOne(
        { user_phone },
        { $inc: { otp_attempts: 1 } },
      );
      throw new ApiError(400, "OTP does not match!");
    }

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "OTP verified successfully!",
    });
  } catch (error) {
    next(error);
  }
};
// ── Resend OTP (Phase D: 6-digit, hashed, rate-limited) ───────────────────────
export const postUserResendCode: RequestHandler = async (req, res, next) => {
  try {
    const { user_phone, user_name } = req.body;
    if (!user_phone) throw new ApiError(400, "Phone required!");

    const user: any = await UserModel.findOne({ user_phone });
    if (!user) throw new ApiError(404, "User not found!");

    if (isWithinSendCooldown(user.otp_sent_at)) {
      const wait = secondsUntilCooldownEnds(user.otp_sent_at);
      throw new ApiError(429, `Please wait ${wait}s before requesting another OTP.`);
    }

    const otp = generateOtp();
    const otpFields = await buildOtpFields(otp);

    const updateOTP = await UserModel.updateOne(
      { user_phone },
      otpFields,
      { runValidators: true },
    );

    if (updateOTP?.modifiedCount > 0) {
      await SendPhoneOTP(otp as any, user_phone, user_name);
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "New OTP sent!",
      });
    } else {
      throw new ApiError(400, "Something went wrong!");
    }
  } catch (error) {
    next(error);
  }
};

// ── Forgot Password — OTP পাঠাও (Phase D: 6-digit hashed + rate-limit) ───────
export const postForgotPasswordUser: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const { user_phone } = req.body;

    const findUser: any = await UserModel.findOne({ user_phone });
    if (!findUser) throw new ApiError(400, "Customer not found!");

    if (isWithinSendCooldown(findUser.otp_sent_at)) {
      const wait = secondsUntilCooldownEnds(findUser.otp_sent_at);
      throw new ApiError(429, `Please wait ${wait}s before requesting another OTP.`);
    }

    const otp = generateOtp();
    const otpFields = await buildOtpFields(otp);

    await SendPhoneOTP(otp as any, user_phone, findUser?.user_name);

    const forgetOTPSave = await UserModel.updateOne(
      { user_phone },
      otpFields,
      { runValidators: true },
    );

    if (forgetOTPSave?.modifiedCount > 0) {
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "OTP sent to your phone!",
        data: { user_name: findUser?.user_name },
      });
    } else {
      throw new ApiError(400, "Something went wrong!");
    }
  } catch (error) {
    next(error);
  }
};

// ── Set New Password (Phase D: bcrypt OTP + attempt cap + full clear) ────────
export const updateforgotPasswordUsersChangeNewPassword: RequestHandler =
  async (req, res, next) => {
    try {
      const { user_phone, user_otp, user_password } = req.body;

      const findUser: any = await UserModel.findOne({ user_phone });
      if (!findUser) throw new ApiError(400, "User not found");

      if (
        findUser?.otp_expires_at &&
        new Date() > new Date(findUser.otp_expires_at)
      ) {
        throw new ApiError(400, "OTP has expired. Please request a new one.");
      }

      if ((findUser.otp_attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
        throw new ApiError(
          429,
          "Too many wrong attempts. Please request a new OTP.",
        );
      }

      const ok = await verifyOtp(user_otp, findUser.forgot_otp);
      if (!ok) {
        await UserModel.updateOne(
          { user_phone },
          { $inc: { otp_attempts: 1 } },
        );
        throw new ApiError(400, "OTP does not match!");
      }

      const hash = await bcrypt.hash(user_password, saltRounds);

      const users = await UserModel.updateOne(
        { user_phone },
        {
          user_password: hash,
          ...otpClearFields(),
          user_verified: true,
          user_type: "registered",
        },
        { runValidators: true },
      );

      if (users?.modifiedCount > 0) {
        // S4+S5 Phase 1C — guest→registered email merge. If the user
        // submitted an email at the post-order prompt before signing
        // up, backfill user.user_email from the most recent guest
        // order on the same phone. Best-effort: silent on failure
        // (e.g. duplicate-email collision with an older account).
        try {
          const userDoc: any = await UserModel.findOne({ user_phone })
            .select("_id user_email")
            .lean();
          if (userDoc && !userDoc.user_email) {
            const lastEmailOrder: any = await OrderModel.findOne({
              customer_phone: user_phone,
              customer_email: { $exists: true, $ne: null },
            })
              .sort({ createdAt: -1 })
              .select("customer_email")
              .lean();
            if (lastEmailOrder?.customer_email) {
              await UserModel.updateOne(
                { _id: userDoc._id },
                { $set: { user_email: lastEmailOrder.customer_email } },
              );
            }
          }
        } catch (mergeErr) {
          // Don't fail the registration flow for a backfill miss.
          console.warn("Phase 1C email merge skipped:", mergeErr);
        }

        return sendResponse(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Password set successfully!",
        });
      } else {
        throw new ApiError(400, "Something went wrong!");
      }
    } catch (error) {
      next(error);
    }
  };

// ── Find All Dashboard Users ───────────────────────────────────────────────────
// B1 (2026-06-04) — accepts optional ?user_type=guest|registered query for
// the admin customer list Type-column filter chip.
export const findAllDashboardUser: RequestHandler = async (req, res, next) => {
  try {
    const { page, limit, searchTerm, user_type } = req.query as Record<
      string,
      string
    >;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const [result, total] = await Promise.all([
      findAllDashboardUserServices(limitNumber, skip, searchTerm, user_type),
      countDashboardUserServices(searchTerm, user_type),
    ]);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "User Found Successfully!",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// ── Update User ────────────────────────────────────────────────────────────────
export const updateUser: RequestHandler = async (req, res, next) => {
  try {
    const requestData = req.body;
    if (!requestData?.user_phone)
      throw new ApiError(400, "Phone Number Required!");
    if (!requestData?.user_name) throw new ApiError(400, "User Name Required!");

    const findUserWithPhoneExist: any = await UserModel.exists({
      user_phone: requestData?.user_phone,
    });
    if (
      findUserWithPhoneExist &&
      requestData?._id !== findUserWithPhoneExist?._id.toString()
    ) {
      throw new ApiError(400, "Someone Already Added This Phone!");
    }

    if (requestData?.user_password) {
      const hash = await bcrypt.hash(requestData?.user_password, saltRounds);
      delete requestData?.user_password;
      const result = await updateUserServices(
        { ...requestData, user_password: hash },
        requestData?._id,
      );
      if (result?.modifiedCount > 0) {
        return sendResponse(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "User Update Successfully!",
        });
      } else {
        throw new ApiError(400, "User Update Failed!");
      }
    } else {
      const result = await updateUserServices(requestData, requestData?._id);
      if (result?.modifiedCount > 0) {
        return sendResponse(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "User Update Successfully!",
        });
      } else {
        throw new ApiError(400, "User Update Failed!");
      }
    }
  } catch (error: any) {
    next(error);
  }
};

// ── Delete User ────────────────────────────────────────────────────────────────
export const deleteAUser: RequestHandler = async (req, res, next) => {
  try {
    const { _id } = req.body;
    const inOrder = await OrderModel.exists({ customer_id: _id });
    if (inOrder) throw new ApiError(400, "Already Have an order!");
    const inOrderProduct = await OrderProductModel.exists({ customer_id: _id });
    if (inOrderProduct) throw new ApiError(400, "Already Have an order!");
    // Phase B — offer orders are in the orders collection now; inOrder covers them.

    const result = await deleteUserServices(_id);
    if (result?.deletedCount > 0) {
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "User Delete Successfully!",
      });
    } else {
      throw new ApiError(400, "User Delete Failed!");
    }
  } catch (error: any) {
    next(error);
  }
};

// ── Refresh access token (Phase D, D2) ────────────────────────────────────────
export const refreshUser: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const {
      verifyTokenAsync,
      COOKIE_NAMES,
    } = require("../../utils/auth.tokens");
    const token = req.cookies?.[COOKIE_NAMES.REFRESH];
    if (!token) throw new ApiError(401, "No refresh token.");

    const decoded: any = await verifyTokenAsync(token);
    if (decoded?.kind !== "refresh" || decoded?.who !== "user") {
      throw new ApiError(401, "Invalid refresh token.");
    }

    const user: any = await UserModel.findById(decoded._id);
    if (!user || user.user_status !== "active") {
      throw new ApiError(401, "User not active.");
    }

    const _id = String(user._id);
    const access = signUserAccess({ _id, user_phone: user.user_phone });
    const refresh = signUserRefresh({ _id, user_phone: user.user_phone });
    setAccessCookie(res, "user", access);
    setRefreshCookie(res, refresh);

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Token refreshed.",
    });
  } catch (error) {
    next(error);
  }
};

// ── User logout — clears both cookies (Phase D, D2) ───────────────────────────
export const logoutUserOwn: RequestHandler = (req, res, next) => {
  try {
    clearAuthCookies(res);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Logged out.",
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// S6 (2026-06-04) — Address CRUD for the logged-in storefront user. Embedded
// `user.addresses[]` (single-shop scale). Invariant: at most one address has
// is_default=true. Each mutation reasserts this invariant atomically so two
// concurrent requests can't both end up default. Anonymous FB-ads checkout
// path is NOT touched here — order.controller.ts still uses the inline
// billing fields from the request body, not these saved addresses.
// ─────────────────────────────────────────────────────────────────────────────

const sanitizeAddressInput = (body: any) => {
  const out: any = {};
  if (body?.label !== undefined) out.label = String(body.label).slice(0, 50);
  if (body?.recipient_name !== undefined)
    out.recipient_name = String(body.recipient_name).slice(0, 100);
  if (body?.recipient_phone !== undefined)
    out.recipient_phone = String(body.recipient_phone).slice(0, 20);
  if (body?.division !== undefined)
    out.division = String(body.division).slice(0, 100);
  if (body?.district !== undefined)
    out.district = String(body.district).slice(0, 100);
  if (body?.address_line !== undefined)
    out.address_line = String(body.address_line).slice(0, 250);
  if (body?.is_default !== undefined) out.is_default = !!body.is_default;
  return out;
};

// GET /user/addresses — list logged-in user's saved addresses
export const listMyAddresses = async (
  req: any,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const userId = req?.user?.id;
    if (!userId) throw new ApiError(401, "Login required.");
    const user: any = await UserModel.findById(userId).select("addresses").lean();
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Addresses fetched.",
      data: user?.addresses || [],
    });
  } catch (error) {
    next(error);
  }
};

// POST /user/address — add a new address; if it's the first one (or
// is_default was sent) it becomes the default and all others are unset.
export const addMyAddress = async (
  req: any,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const userId = req?.user?.id;
    if (!userId) throw new ApiError(401, "Login required.");
    const payload = sanitizeAddressInput(req.body);
    const user: any = await UserModel.findById(userId);
    if (!user) throw new ApiError(404, "User not found.");
    const list: any[] = user.addresses || [];
    // First address always becomes the default no matter what the client
    // sent — otherwise checkout has no address to auto-fill from.
    const makeDefault = list.length === 0 ? true : !!payload.is_default;
    if (makeDefault) list.forEach((a: any) => (a.is_default = false));
    list.push({ ...payload, is_default: makeDefault });
    user.addresses = list;
    await user.save();
    sendResponse(res, {
      statusCode: 201,
      success: true,
      message: "Address added.",
      data: user.addresses,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /user/address/:address_id — edit one field-by-field
export const updateMyAddress = async (
  req: any,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const userId = req?.user?.id;
    if (!userId) throw new ApiError(401, "Login required.");
    const { address_id } = req.params;
    if (!address_id) throw new ApiError(400, "Missing address_id.");
    const payload = sanitizeAddressInput(req.body);
    const user: any = await UserModel.findById(userId);
    if (!user) throw new ApiError(404, "User not found.");
    const list: any[] = user.addresses || [];
    const target = list.find((a: any) => String(a._id) === String(address_id));
    if (!target) throw new ApiError(404, "Address not found.");
    // If client flips this row to default, unset every other row first.
    if (payload.is_default === true) {
      list.forEach((a: any) => (a.is_default = false));
    }
    Object.assign(target, payload);
    user.addresses = list;
    await user.save();
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Address updated.",
      data: user.addresses,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /user/address/:address_id — remove; if removed was default,
// the first remaining address is promoted so the list always has exactly
// one default when non-empty.
export const deleteMyAddress = async (
  req: any,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const userId = req?.user?.id;
    if (!userId) throw new ApiError(401, "Login required.");
    const { address_id } = req.params;
    if (!address_id) throw new ApiError(400, "Missing address_id.");
    const user: any = await UserModel.findById(userId);
    if (!user) throw new ApiError(404, "User not found.");
    const list: any[] = user.addresses || [];
    const idx = list.findIndex(
      (a: any) => String(a._id) === String(address_id),
    );
    if (idx === -1) throw new ApiError(404, "Address not found.");
    const wasDefault = !!list[idx].is_default;
    list.splice(idx, 1);
    if (wasDefault && list.length > 0) {
      list[0].is_default = true;
    }
    user.addresses = list;
    await user.save();
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Address removed.",
      data: user.addresses,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /user/address/:address_id/default — explicitly promote one to
// default. Unsetting the default without picking a new one is not allowed
// (UI should call update with a different row's is_default=true instead).
export const setMyDefaultAddress = async (
  req: any,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const userId = req?.user?.id;
    if (!userId) throw new ApiError(401, "Login required.");
    const { address_id } = req.params;
    if (!address_id) throw new ApiError(400, "Missing address_id.");
    const user: any = await UserModel.findById(userId);
    if (!user) throw new ApiError(404, "User not found.");
    const list: any[] = user.addresses || [];
    const target = list.find((a: any) => String(a._id) === String(address_id));
    if (!target) throw new ApiError(404, "Address not found.");
    list.forEach((a: any) => (a.is_default = false));
    target.is_default = true;
    user.addresses = list;
    await user.save();
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Default address updated.",
      data: user.addresses,
    });
  } catch (error) {
    next(error);
  }
};

// S4+S5 Phase 1C — opt-in email for the logged-in storefront user.
// Accepts { user_email } in body. Validates basic email shape; the
// unique-sparse index on user_email handles duplicate-collision at
// DB layer (Mongo throws E11000, global handler maps to 4xx).
//
// Empty / missing field is rejected — to remove an email use a
// separate DELETE flow (not built; out of scope for Phase 1C).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const setMyEmail = async (
  req: any,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const userId = req?.user?.id;
    if (!userId) throw new ApiError(401, "Login required.");
    const raw = (req.body?.user_email || "").trim().toLowerCase();
    if (!raw || !EMAIL_RE.test(raw)) {
      throw new ApiError(400, "Please provide a valid email address.");
    }
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: { user_email: raw } },
      { new: true, runValidators: true },
    ).select("-user_password -forgot_otp");
    if (!user) throw new ApiError(404, "User not found.");
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Email saved.",
      data: { user_email: user.user_email },
    });
  } catch (error: any) {
    // E11000 = unique violation (another user already has this email).
    if (error?.code === 11000) {
      return next(
        new ApiError(409, "This email is already linked to another account."),
      );
    }
    next(error);
  }
};
