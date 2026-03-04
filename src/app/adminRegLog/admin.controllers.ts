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
const bcrypt = require("bcryptjs");
const saltRounds = 10;
const jwt = require("jsonwebtoken");
const { promisify } = require("util");

// get a Admin
export const getMeAdmin: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = await req.cookies?.artisan_lather_token;

    if (!token) {
      throw new ApiError(400, "Admin get failed !");
    }
    const decode = await promisify(jwt.verify)(token, process.env.ACCESS_TOKEN);
    // const decode = await promisify(jwt.verify)(token, process.env.ACCESS_TOKEN);

    const Admin = await findAdminInfoServices(decode.admin_phone);

    if (Admin) {
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Admin get successfully !",
        data: Admin,
      });
    }
    throw new ApiError(400, "Admin get failed !");
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
      const admin_phone = findAdmin?.admin_phone;
      const token = jwt.sign({ admin_phone }, process.env.ACCESS_TOKEN, {
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
