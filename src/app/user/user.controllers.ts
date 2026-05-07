import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import sendResponse from "../../shared/sendResponse";
import { IUserInterface, userSearchableField } from "./user.interface";
import {
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
    const { user_password, user_phone } = req.body;

    if (!user_password || !user_phone)
      throw new ApiError(400, "Phone and Password are required.");

    const findUser: any = await UserModel.findOne({ user_phone });
    if (!findUser) throw new ApiError(400, "User not found.");
    if (findUser.user_status === "in-active")
      throw new ApiError(400, "Invalid User!");

    if (!findUser.user_password) {
      const hashedPassword = await bcrypt.hash(user_password, saltRounds);
      const result = await UserModel.updateOne(
        { user_phone },
        {
          user_password: hashedPassword,
          user_verified: true,
          user_type: "registered",
        },
        { runValidators: true },
      );
      if (result.modifiedCount === 0)
        throw new ApiError(400, "User update failed!");
    } else {
      const isPasswordValid = await bcrypt.compare(
        user_password,
        findUser.user_password,
      );
      if (!isPasswordValid) throw new ApiError(400, "Password does not match!");
    }

    const token = jwt.sign({ user_phone }, process.env.ACCESS_TOKEN, {
      expiresIn: "365d",
    });
    res.cookie("fruit_snacks_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });

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

    const findUser: any = await UserModel.findOne({ user_phone: phone });

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


//  ── Verify OTP ───────────────────────────────────────
export const verifyUserOTP: RequestHandler = async (req, res, next) => {
  try {
    const { user_phone, user_otp } = req.body;

    if (!user_phone || !user_otp) {
      throw new ApiError(400, "Phone and OTP required!");
    }

    const findUser: any = await UserModel.findOne({ user_phone });
    if (!findUser) throw new ApiError(400, "User not found!");

    if (findUser?.forgot_otp != user_otp) {
      throw new ApiError(400, "OTP does not match!");
    }

    if (findUser?.otp_expires_at && new Date() > new Date(findUser.otp_expires_at)) {
      throw new ApiError(400, "OTP has expired. Please request a new one.");
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
// ── Resend OTP ─────────────────────────────────────────────────────────────────
export const postUserResendCode: RequestHandler = async (req, res, next) => {
  try {
    const { user_phone, user_name } = req.body;
    const user_otp = Math.floor(1000 + Math.random() * 9000);
    const otp_expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    const updateOTP = await UserModel.updateOne(
      { user_phone },
      { forgot_otp: user_otp, otp_expires_at },
      { runValidators: true },
    );

    if (updateOTP?.modifiedCount > 0) {
      await SendPhoneOTP(user_otp, user_phone, user_name);
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

// ── Forgot Password — OTP পাঠাও ───────────────────────────────────────────────
export const postForgotPasswordUser: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const { user_phone } = req.body;

    const findUser: any = await UserModel.findOne({ user_phone });
    if (!findUser) throw new ApiError(400, "Customer not found!");

    const user_otp = Math.floor(1000 + Math.random() * 9000);
    const otp_expires_at = new Date(Date.now() + 10 * 60 * 1000); // ✅ 10 min expiry

    await SendPhoneOTP(user_otp, user_phone, findUser?.user_name);

    const forgetOTPSave = await UserModel.updateOne(
      { user_phone },
      { forgot_otp: user_otp, otp_expires_at },
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

// ── Set New Password (Forgot + Guest both) ─────────────────────────────────────
export const updateforgotPasswordUsersChangeNewPassword: RequestHandler =
  async (req, res, next) => {
    try {
      const { user_phone, user_otp, user_password } = req.body;

      const findUser: any = await UserModel.findOne({ user_phone });
      if (!findUser) throw new ApiError(400, "User not found");

      // ✅ OTP match check
      if (findUser?.forgot_otp != user_otp)
        throw new ApiError(400, "OTP does not match!");

      // ✅ OTP expiry check
      if (
        findUser?.otp_expires_at &&
        new Date() > new Date(findUser.otp_expires_at)
      ) {
        throw new ApiError(400, "OTP has expired. Please request a new one.");
      }

      const hash = await bcrypt.hash(user_password, saltRounds);

      const users = await UserModel.updateOne(
        { user_phone },
        {
          user_password: hash,
          forgot_otp: null, // ✅ OTP clear
          otp_expires_at: null, // ✅ expiry clear
          user_verified: true, // ✅ verified mark
          user_type: "registered", // ✅ registered mark
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
export const findAllDashboardUser: RequestHandler = async (req, res, next) => {
  try {
    const { page, limit, searchTerm } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result = await findAllDashboardUserServices(
      limitNumber,
      skip,
      searchTerm,
    );
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: userSearchableField.map((field) => ({
          [field]: { $regex: searchTerm, $options: "i" },
        })),
      });
    }
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await UserModel.countDocuments(whereCondition);
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
