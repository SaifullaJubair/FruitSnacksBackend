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

// Add A User
export const postUser: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<IUserInterface | any> => {
  try {
    const requestData = req.body;

    if (!requestData?.user_name) {
      throw new ApiError(400, "User Name Required !");
    }
    if (!requestData?.user_password) {
      throw new ApiError(400, "Password Required !");
    }
    if (!requestData?.user_phone) {
      throw new ApiError(400, "User Phone Required !");
    }

    const existingUser = await UserModel.findOne({
      user_phone: requestData?.user_phone,
    });

    if (existingUser && existingUser?.user_password) {
      throw new ApiError(400, "Already Added This Phone Please Login !");
    }

    // Hash the password once
    const hashedPassword = await bcrypt.hash(
      requestData?.user_password,
      saltRounds,
    );
    delete requestData?.user_password; // Remove plain password

    if (existingUser) {
      // If user exists but doesn't have a password, update password
      const updateResult = await UserModel.updateOne(
        { user_phone: requestData?.user_phone },
        { user_password: hashedPassword },
        { runValidators: true },
      );

      if (updateResult.modifiedCount > 0) {
        return sendResponse<IUserInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Signup Successfully !",
        });
      } else {
        throw new ApiError(400, "User Update Failed !");
      }
    } else {
      // If user does not exist, create a new user
      const newUserData = {
        ...requestData,
        user_password: hashedPassword,
      };

      const newUser = await postUserServices(newUserData);

      if (newUser) {
        return sendResponse<IUserInterface>(res, {
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

    if (!user_password || !user_phone) {
      throw new ApiError(400, "Phone and Password are required.");
    }

    const findUser: any = await UserModel.findOne({ user_phone });

    if (!findUser) {
      throw new ApiError(400, "User not found.");
    }

    // Check if user is inactive
    if (findUser.user_status === "in-active") {
      throw new ApiError(400, "Invalid User!");
    }

    // If user exists but has no password, hash and update password
    if (!findUser.user_password) {
      const hashedPassword = await bcrypt.hash(user_password, saltRounds);

      const result = await UserModel.updateOne(
        { user_phone },
        { user_password: hashedPassword },
        { runValidators: true },
      );

      if (result.modifiedCount === 0) {
        throw new ApiError(400, "User update failed!");
      }

      const token = jwt.sign({ user_phone }, process.env.ACCESS_TOKEN, {
        expiresIn: "365d",
      });

      // res.cookie("artisan_lather_token", token); //according to chatgpt for access cookies separate domain i have to use like this
      res.cookie("artisan_lather_token", token, {
        httpOnly: true, // নিরাপত্তার জন্য
        secure: true, // https connection এর জন্য অবশ্যই true লাগবে
        sameSite: "none", // cross-domain এর জন্য required
        maxAge: 365 * 24 * 60 * 60 * 1000, // optional, 1 year
      });
      // Server side Login event
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

      return sendResponse<IUserInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Sign in Successfully!",
      });
    }

    // Compare password if user already has one
    const isPasswordValid = await bcrypt.compare(
      user_password,
      findUser.user_password,
    );

    if (!isPasswordValid) {
      throw new ApiError(400, "Password does not match!");
    }

    const token = jwt.sign({ user_phone }, process.env.ACCESS_TOKEN, {
      expiresIn: "365d",
    });

    // res.cookie("artisan_lather_token", token); //according to chatgpt for access cookies separate domain i have to use like this
    res.cookie("artisan_lather_token", token, {
      httpOnly: true, // নিরাপত্তার জন্য
      secure: true, // https connection এর জন্য অবশ্যই true লাগবে
      sameSite: "none", // cross-domain এর জন্য required
      maxAge: 365 * 24 * 60 * 60 * 1000, // optional, 1 year
    });

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "User logged in successfully!",
    });
  } catch (error) {
    next(error);
  }
};

// resend his OTP and also update in DB
export const postUserResendCode: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { user_phone, user_name } = req.body;
    const user_otp = Math.floor(1000 + Math.random() * 9000);
    const updateOTP = await updateUserOTPServices(user_otp, user_phone);

    if (updateOTP?.modifiedCount > 0) {
      await SendPhoneOTP(user_otp, user_phone, user_name);
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "New OTP send !",
      });
    } else {
      throw new ApiError(400, "Some thing went wrong !");
    }
  } catch (error) {
    next(error);
  }
};

// send link to create new password if he forgot password
export const postForgotPasswordUser: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { user_phone } = req.body;

    const findUser: any = await UserModel.findOne({
      user_phone: user_phone,
    });

    if (!findUser) {
      throw new ApiError(400, "Customer not found !");
    }

    const user_otp = Math.floor(1000 + Math.random() * 9000);

    await SendPhoneOTP(user_otp, user_phone, findUser?.user_name);

    const forgetOTPSave = await updateLogUsersNewOTPService(
      user_phone,
      user_otp,
    );
    if (forgetOTPSave?.modifiedCount > 0) {
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Check Your phone !",
        data: { user_name: findUser?.user_name },
      });
    } else {
      throw new ApiError(400, "Some thing went wrong !");
    }
  } catch (error) {
    next(error);
  }
};

//create new password if he forgot password
export const updateforgotPasswordUsersChangeNewPassword: RequestHandler =
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user_phone, user_otp, user_password } = req.body;

      const findUser: any = await UserModel.findOne({
        user_phone: user_phone,
      });

      if (!findUser) {
        throw new ApiError(400, "User not found");
      }

      if (findUser?.forgot_otp != user_otp) {
        throw new ApiError(400, "OTP not match !");
      }

      bcrypt.hash(
        user_password,
        saltRounds,
        async function (err: Error, hash: string) {
          const users = await updateforgotPasswordUsersChangeNewPasswordService(
            user_phone,
            hash,
          );
          if (users?.modifiedCount > 0) {
            return sendResponse(res, {
              statusCode: httpStatus.OK,
              success: true,
              message: "Password change successfully !",
            });
          } else {
            throw new ApiError(400, "Some thing went wrong !");
          }
        },
      );
    } catch (error) {
      next(error);
    }
  };

// Find All dashboard User
export const findAllDashboardUser: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<IUserInterface | any> => {
  try {
    const { page, limit, searchTerm } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: IUserInterface[] | any = await findAllDashboardUserServices(
      limitNumber,
      skip,
      searchTerm,
    );
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: userSearchableField.map((field) => ({
          [field]: {
            $regex: searchTerm,
            $options: "i",
          },
        })),
      });
    }
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await UserModel.countDocuments(whereCondition);
    return sendResponse<IUserInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "User Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update A User
export const updateUser: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<IUserInterface | any> => {
  try {
    const requestData = req.body;
    if (!requestData?.user_phone) {
      throw new ApiError(400, "Phone Number Required !");
    }
    if (!requestData?.user_name) {
      throw new ApiError(400, "User Name Required !");
    }

    const findUserWithEmailOrPhoneExist: boolean | null | undefined | any =
      await UserModel.exists({
        user_phone: requestData?.user_phone,
      });

    if (
      findUserWithEmailOrPhoneExist &&
      requestData?._id !== findUserWithEmailOrPhoneExist?._id.toString()
    ) {
      throw new ApiError(400, "Someone Already Added This Phone !");
    }

    if (requestData?.user_password) {
      bcrypt.hash(
        requestData?.user_password,
        saltRounds,
        async function (err: Error, hash: string) {
          delete requestData?.user_password;
          const data = { ...requestData, user_password: hash };
          const result: IUserInterface | any = await updateUserServices(
            data,
            requestData?._id,
          );
          if (result?.modifiedCount > 0) {
            return sendResponse<IUserInterface>(res, {
              statusCode: httpStatus.OK,
              success: true,
              message: "User Update Successfully !",
            });
          } else {
            throw new ApiError(400, "User Update Failed !");
          }
        },
      );
    } else {
      const result: IUserInterface | any = await updateUserServices(
        requestData,
        requestData?._id,
      );
      if (result?.modifiedCount > 0) {
        return sendResponse<IUserInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "User Update Successfully !",
        });
      } else {
        throw new ApiError(400, "User Update Failed !");
      }
    }
  } catch (error: any) {
    next(error);
  }
};

// Delete aUser
export const deleteAUser: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<IUserInterface | any> => {
  try {
    const data = req.body;
    const _id = data?._id;

    const findUserInOrderExist: boolean | null | undefined | any =
      await OrderModel.exists({
        customer_id: _id,
      });
    if (findUserInOrderExist) {
      throw new ApiError(400, "Already Have an order !");
    }
    const findUserInOrderProductExist: boolean | null | undefined | any =
      await OrderProductModel.exists({
        customer_id: _id,
      });
    if (findUserInOrderProductExist) {
      throw new ApiError(400, "Already Have an order !");
    }
    const findUserInOfferOrderProductExist: boolean | null | undefined | any =
      await OfferOrderModel.exists({
        customer_id: _id,
      });
    if (findUserInOfferOrderProductExist) {
      throw new ApiError(400, "Already Have an order !");
    }

    const result: IUserInterface[] | any = await deleteUserServices(_id);

    if (result?.deletedCount > 0) {
      return sendResponse<IUserInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "User Delete Successfully !",
      });
    } else {
      throw new ApiError(400, "User Delete Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};
