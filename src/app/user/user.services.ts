import mongoose from "mongoose";
import ApiError from "../../errors/ApiError";
import {
  IUserInterface,
  userSearchableField,
  USER_PUBLIC_PROJECTION,
} from "./user.interface";
import UserModel from "./user.model";

// Create A User
export const postUserServices = async (
  data: IUserInterface
): Promise<IUserInterface | {}> => {
  const createUser: IUserInterface | {} = await UserModel.create(data);
  return createUser;
};
export const postSingleOrderUserServices = async (
  data: IUserInterface,
  session: mongoose.ClientSession
): Promise<IUserInterface | {} | any> => {
  const createUser: IUserInterface | {} | any = await UserModel.create([data], { session });
  if (!createUser) throw new ApiError(400, "User Create Failed !");
  const sendData: any = createUser?.[0];
  return sendData;
};

// Update OTP and send new OTP
export const updateUserOTPServices = async (
  user_otp: number,
  user_phone: string
): Promise<IUserInterface | any> => {
  const findUser: IUserInterface | null = await UserModel.findOne({
    user_phone: user_phone,
  });
  if (!findUser) {
    throw new ApiError(400, "User not found");
  }
  const users = await UserModel.updateOne(
    { user_phone: user_phone },
    { forgot_otp: user_otp },
    {
      runValidators: true,
    }
  );
  return users;
};

// send link to create new password if he forgot password so change the new otp
export const updateLogUsersNewOTPService = async (
  user_phone: string,
  user_otp: number
): Promise<IUserInterface | any> => {
  const findUser: any = await UserModel.findOne({ user_phone: user_phone });
  if (!findUser) throw new ApiError(400, "User not found");
  const users = await UserModel.updateOne(
    { user_phone: user_phone },
    { forgot_otp: user_otp },
    {
      runValidators: true,
    }
  );
  return users;
};

// update new password if he forgot
export const updateforgotPasswordUsersChangeNewPasswordService = async (
  user_phone: string,
  user_password: string
): Promise<IUserInterface | any> => {
  const findUser: IUserInterface | null = await UserModel.findOne({
    user_phone: user_phone,
  });
  if (findUser) {
    const users = await UserModel.updateOne(
      { user_phone: user_phone },
      { user_password: user_password },
      {
        runValidators: true,
      }
    );
    return users;
  } else {
    throw new ApiError(400, "User not found");
  }
};

// Find all dashboard User
// B1 (2026-06-04) — accepts optional `user_type` filter ("guest" | "registered")
// for the admin customer list Type-column filter chip.
export const findAllDashboardUserServices = async (
  limit: number,
  skip: number,
  searchTerm: any,
  userType?: string,
): Promise<IUserInterface[] | []> => {
  const andCondition: any[] = [];
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
  if (userType === "guest" || userType === "registered") {
    andCondition.push({ user_type: userType });
  }
  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};
  const findUser: IUserInterface[] | [] = await UserModel.find(whereCondition)
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    // SECURITY: allow-list, not .select("-__v") — the deny-list shipped every
    // customer's user_password hash + forgot_otp to the admin list (the
    // staff-list leak class). Ported from core 2026-07-17.
    .select(USER_PUBLIC_PROJECTION);
  return findUser;
};

// B1 — matching countDocuments helper so the controller can reuse the same
// where-condition for pagination total.
export const countDashboardUserServices = async (
  searchTerm: any,
  userType?: string,
): Promise<number> => {
  const andCondition: any[] = [];
  if (searchTerm) {
    andCondition.push({
      $or: userSearchableField.map((field) => ({
        [field]: { $regex: searchTerm, $options: "i" },
      })),
    });
  }
  if (userType === "guest" || userType === "registered") {
    andCondition.push({ user_type: userType });
  }
  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};
  return UserModel.countDocuments(whereCondition);
};

// Update a User
export const updateUserServices = async (
  data: IUserInterface,
  _id: string
): Promise<IUserInterface | any> => {
  const updateUserInfo: IUserInterface | null = await UserModel.findOne({
    _id: _id,
  });
  if (!updateUserInfo) {
    throw new ApiError(400, "User not found");
  }
  const User = await UserModel.updateOne({ _id: _id }, data, {
    runValidators: true,
  });
  return User;
};

// delete a User start

export const deleteUserServices = async (
  _id: string
): Promise<IUserInterface | any> => {
  const deleteUserInfo: IUserInterface | null = await UserModel.findOne({
    _id: _id,
  });
  if (!deleteUserInfo) {
    throw new ApiError(400, "User not found");
  }
  const User = await UserModel.deleteOne(
    { _id: _id },
    {
      runValidators: true,
    }
  );
  return User;
};
