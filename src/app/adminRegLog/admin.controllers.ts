import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import sendResponse from "../../shared/sendResponse";
import { adminSearchableField, IAdminInterface } from "./admin.interface";
import AdminModel from "./admin.model";
import {
  deleteAdminServices,
  findAdminInfoServices,
  findAllDashboardAdminRoleAdminServices,
  postAdminServices,
  updateAdminServices,
} from "./admin.services";
import {
  signAdminAccess,
  signAdminRefresh,
  setAccessCookie,
  setRefreshCookie,
  clearAuthCookies,
} from "../../utils/auth.tokens";
const bcrypt = require("bcryptjs");
const saltRounds = 10;
const jwt = require("jsonwebtoken");
const { promisify } = require("util");

// get a Admin (Phase D: uses central token helper; rejects refresh-typed token)
export const getMeAdmin: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.cookies?.[
      require("../../utils/auth.tokens").COOKIE_NAMES.ACCESS
    ];
    if (!token) throw new ApiError(401, "Admin get failed !");

    const { verifyTokenAsync } = require("../../utils/auth.tokens");
    const decode: any = await verifyTokenAsync(token);
    if (decode?.kind && decode.kind !== "access") {
      throw new ApiError(401, "Refresh token cannot be used as access.");
    }
    if (decode?.who && decode.who !== "admin") {
      throw new ApiError(401, "Not an admin token.");
    }

    const Admin = decode?._id
      ? await AdminModel.findById(decode._id).populate("role_id")
      : await findAdminInfoServices(decode.admin_phone);

    if (Admin) {
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Admin get successfully !",
        data: Admin,
      });
    }
    throw new ApiError(404, "Admin not found !");
  } catch (error) {
    next(error);
  }
};

// Add A Admin
export const postAdmin: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<IAdminInterface | any> => {
  try {
    const requestData = req.body;
    if (!requestData?.admin_phone) {
      throw new ApiError(400, "Phone Number Required !");
    }
    if (!requestData?.admin_name) {
      throw new ApiError(400, "Admin Name Required !");
    }
    if (!requestData?.admin_password) {
      throw new ApiError(400, "Password Required !");
    }
    if (!requestData?.admin_status) {
      throw new ApiError(400, "Admin Status Required !");
    }
    if (!requestData?.role_id) {
      throw new ApiError(400, "Admin Role Required !");
    }

    const findAdminWithEmailOrPhoneExist: boolean | null | undefined | any =
      await AdminModel.exists({
        admin_phone: requestData?.admin_phone,
      });

    if (findAdminWithEmailOrPhoneExist) {
      throw new ApiError(400, "Already Added This Phone !");
    }
    bcrypt.hash(
      requestData?.admin_password,
      saltRounds,
      async function (err: Error, hash: string) {
        delete requestData?.admin_password;
        const data = {
          ...requestData,
          admin_password: hash,
        };
        try {
          const result: IAdminInterface | {} = await postAdminServices(data);
          if (result) {
            return sendResponse<IAdminInterface>(res, {
              statusCode: httpStatus.OK,
              success: true,
              message: "Admin Added Successfully !",
            });
          } else {
            throw new ApiError(400, "Admin Added Failed !");
          }
        } catch (error) {
          next(error);
        }
      },
    );
  } catch (error: any) {
    next(error);
  }
};

// login a Admin
export const postLogAdmin: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { admin_password, admin_phone } = req.body;

    const findAdmin: IAdminInterface | null = await AdminModel.findOne({
      admin_phone: admin_phone,
    });
    if (!findAdmin) {
      throw new ApiError(400, "Admin Not Found !");
    }
    if (findAdmin?.admin_status == "in-active") {
      throw new ApiError(400, "Inactive Admin !");
    }

    const isPasswordValid = await bcrypt.compare(
      admin_password,
      findAdmin?.admin_password,
    );
    if (isPasswordValid) {
      // Phase D: payload now carries _id (+ role_id) so the middleware can
      // skip the phone→admin lookup. Cookie lifetime tightened from 1y → 7d
      // access + 90d refresh — see utils/auth.tokens for the constants.
      const _id = String(findAdmin?._id);
      const access = signAdminAccess({
        _id,
        admin_phone: findAdmin.admin_phone,
        role_id: findAdmin?.role_id ? String(findAdmin.role_id) : undefined,
      });
      const refresh = signAdminRefresh({
        _id,
        admin_phone: findAdmin.admin_phone,
      });
      setAccessCookie(res, "admin", access);
      setRefreshCookie(res, refresh);

      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Admin log in successfully !",
      });
    } else {
      throw new ApiError(400, "Password not match !");
    }
  } catch (error) {
    next(error);
  }
};

// Find All dashboard Admi Role Admin
export const findAllDashboardAdminRoleAdmin: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<IAdminInterface | any> => {
  try {
    const { page, limit, searchTerm } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: IAdminInterface[] | any =
      await findAllDashboardAdminRoleAdminServices(
        limitNumber,
        skip,
        searchTerm,
      );
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: adminSearchableField.map((field) => ({
          [field]: {
            $regex: searchTerm,
            $options: "i",
          },
        })),
      });
    }
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await AdminModel.countDocuments(whereCondition);
    return sendResponse<IAdminInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Admin Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update A Admin
export const updateAdmin: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<IAdminInterface | any> => {
  try {
    const requestData = req.body;
    if (!requestData?.admin_phone) {
      throw new ApiError(400, "Phone Number Required !");
    }

    const findAdminWithEmailOrPhoneExist: boolean | null | undefined | any =
      await AdminModel.exists({
        admin_phone: requestData?.admin_phone,
      });

    if (
      findAdminWithEmailOrPhoneExist &&
      requestData?._id !== findAdminWithEmailOrPhoneExist?._id.toString()
    ) {
      throw new ApiError(400, "Already Added This Phone !");
    }

    if (requestData?.admin_password) {
      bcrypt.hash(
        requestData?.admin_password,
        saltRounds,
        async function (err: Error, hash: string) {
          delete requestData?.admin_password;
          const data = { ...requestData, admin_password: hash };
          const result: IAdminInterface | any = await updateAdminServices(
            data,
            requestData?._id,
          );
          if (result?.modifiedCount > 0) {
            return sendResponse<IAdminInterface>(res, {
              statusCode: httpStatus.OK,
              success: true,
              message: "Admin Update Successfully !",
            });
          } else {
            throw new ApiError(400, "Admin Update Failed !");
          }
        },
      );
    } else {
      const result: IAdminInterface | any = await updateAdminServices(
        requestData,
        requestData?._id,
      );
      if (result?.modifiedCount > 0) {
        return sendResponse<IAdminInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Admin Update Successfully !",
        });
      } else {
        throw new ApiError(400, "Admin Update Failed !");
      }
    }
  } catch (error: any) {
    next(error);
  }
};

// Delete a Admin
export const deleteAAdmin: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<IAdminInterface | any> => {
  try {
    const data = req.body;
    const _id = data?._id;
    const result: IAdminInterface[] | any = await deleteAdminServices(_id);

    if (result?.deletedCount > 0) {
      return sendResponse<IAdminInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Admin Delete Successfully !",
      });
    } else {
      throw new ApiError(400, "Admin Delete Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};

// ── Refresh access token (Phase D, D2) ────────────────────────────────────────
// Reads the refresh cookie, validates it, confirms the admin is still active,
// then re-issues access + refresh (rotating refresh too — small upgrade over
// "just access" because it keeps long-lived sessions alive without re-login).
export const refreshAdmin: RequestHandler = async (
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
    if (decoded?.kind !== "refresh" || decoded?.who !== "admin") {
      throw new ApiError(401, "Invalid refresh token.");
    }

    const admin: any = await AdminModel.findById(decoded._id);
    if (!admin || admin.admin_status !== "active") {
      throw new ApiError(401, "Admin not active.");
    }

    const _id = String(admin._id);
    const access = signAdminAccess({
      _id,
      admin_phone: admin.admin_phone,
      role_id: admin?.role_id ? String(admin.role_id) : undefined,
    });
    const refresh = signAdminRefresh({ _id, admin_phone: admin.admin_phone });
    setAccessCookie(res, "admin", access);
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

// ── Admin logout — clears both cookies (Phase D, D2) ──────────────────────────
export const logoutAdmin: RequestHandler = (req, res, next) => {
  try {
    clearAuthCookies(res);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Admin logged out.",
    });
  } catch (error) {
    next(error);
  }
};

// ── Admin forgot password — send OTP (H-B: phone OR email channel) ────────────
// channel = "phone" (default) → SMS via SendPhoneOTP
// channel = "email" → SMTP via SendEmailOTP
// Both channels share the same OTP fields in the admin doc.
export const forgotPasswordAdmin: RequestHandler = async (req, res, next) => {
  try {
    const { generateOtp, buildOtpFields, isWithinSendCooldown, secondsUntilCooldownEnds } =
      require("../../utils/auth.otp");
    const { SendPhoneOTP } = require("../../middlewares/send.otp.phone");
    const { SendEmailOTP } = require("../../middlewares/send.otp.email");

    const { admin_phone, admin_email, channel = "phone" } = req.body;

    let admin: any;
    if (channel === "email") {
      if (!admin_email) throw new ApiError(400, "Email required!");
      admin = await AdminModel.findOne({ admin_email });
      if (!admin) throw new ApiError(404, "No admin account found with this email.");
    } else {
      if (!admin_phone) throw new ApiError(400, "Phone required!");
      admin = await AdminModel.findOne({ admin_phone });
      if (!admin) throw new ApiError(404, "Admin not found!");
    }

    if (admin.admin_status !== "active") {
      throw new ApiError(403, "Admin is inactive.");
    }

    if (isWithinSendCooldown(admin.otp_sent_at)) {
      const wait = secondsUntilCooldownEnds(admin.otp_sent_at);
      throw new ApiError(429, `Please wait ${wait}s before requesting another OTP.`);
    }

    const otp = generateOtp();
    const otpFields = await buildOtpFields(otp);

    const lookupKey = channel === "email" ? { admin_email } : { admin_phone: admin.admin_phone };
    const otpSave = await AdminModel.updateOne(lookupKey, otpFields, { runValidators: true });
    if (otpSave?.modifiedCount === 0) {
      throw new ApiError(500, "Could not save OTP. Please try again.");
    }

    if (channel === "email") {
      const sent = await SendEmailOTP(otp, admin_email, admin?.admin_name);
      if (!sent) throw new ApiError(503, "Email could not be sent. Check email settings or use phone OTP.");
      return sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "OTP sent to your email." });
    } else {
      await SendPhoneOTP(otp, admin.admin_phone, admin?.admin_name);
      return sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "OTP sent to your phone." });
    }
  } catch (error) {
    next(error);
  }
};

// ── Admin reset password — verify OTP + set new password (H-B: phone OR email) ─
export const resetPasswordAdmin: RequestHandler = async (req, res, next) => {
  try {
    const { verifyOtp, otpClearFields, OTP_MAX_ATTEMPTS } = require("../../utils/auth.otp");

    const { admin_phone, admin_email, admin_otp, admin_password, channel = "phone" } = req.body;
    if (!admin_otp || !admin_password) {
      throw new ApiError(400, "OTP and new password required!");
    }

    let admin: any;
    let lookupKey: Record<string, string>;
    if (channel === "email") {
      if (!admin_email) throw new ApiError(400, "Email required!");
      admin = await AdminModel.findOne({ admin_email });
      lookupKey = { admin_email };
    } else {
      if (!admin_phone) throw new ApiError(400, "Phone required!");
      admin = await AdminModel.findOne({ admin_phone });
      lookupKey = { admin_phone };
    }
    if (!admin) throw new ApiError(404, "Admin not found!");

    if (admin?.otp_expires_at && new Date() > new Date(admin.otp_expires_at)) {
      throw new ApiError(400, "OTP has expired. Please request a new one.");
    }

    if ((admin.otp_attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
      throw new ApiError(429, "Too many wrong attempts. Please request a new OTP.");
    }

    const ok = await verifyOtp(admin_otp, admin.forgot_otp);
    if (!ok) {
      const incOk = await AdminModel.updateOne(lookupKey, { $inc: { otp_attempts: 1 } });
      if (incOk?.modifiedCount === 0) {
        throw new ApiError(500, "OTP attempt counter failed. Try again.");
      }
      throw new ApiError(400, "OTP does not match!");
    }

    const hash = await bcrypt.hash(admin_password, saltRounds);
    const setOk = await AdminModel.updateOne(
      lookupKey,
      { admin_password: hash, ...otpClearFields() },
      { runValidators: true },
    );
    if (setOk?.modifiedCount === 0) {
      throw new ApiError(500, "Password reset failed. Please try again.");
    }

    return sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Password reset successfully." });
  } catch (error) {
    next(error);
  }
};
