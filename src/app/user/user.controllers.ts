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
import OfferOrderModel from "../offerOrder/offerOrder.model";
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
      const updateResult = await UserModel.updateOne(
        { user_phone: requestData?.user_phone },
        {
          user_password: hashedPassword,
          user_verified: true, // ✅
          user_type: "registered", // ✅
        },
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
      const newUser = await postUserServices({
        ...requestData,
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
    const inOfferOrder = await OfferOrderModel.exists({ customer_id: _id });
    if (inOfferOrder) throw new ApiError(400, "Already Have an order!");

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
