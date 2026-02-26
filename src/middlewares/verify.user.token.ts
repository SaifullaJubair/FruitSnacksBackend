import { NextFunction, Request, Response } from "express";
import { promisify } from "util";
import ApiError from "../errors/ApiError";
import UserModel from "../app/user/user.model";
const jwt = require("jsonwebtoken");

const JWT_SECRET =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Im5hem11bEBnbWFpbC5jb20iLCJpYXQiOjE2OTQ0MzExOTF9.xtLPsJrvJ0Gtr4rsnHh1kok51_pU10_hYLilZyBiRAM";

interface UserRequest extends Request {
  user?: any;
}

export const verifyUserToken = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const token = req.cookies?.artisan_lather_token;
    if (!token) throw new ApiError(401, "Login required!");

    const decoded: any = await promisify(jwt.verify)(token, JWT_SECRET);

    // user_phone দিয়ে user খুঁজো
    const user = await UserModel.findOne({
      user_phone: decoded?.user_phone,
      user_status: "active",
    }).select("-user_password -forgot_otp");

    if (!user) throw new ApiError(401, "Invalid user!");

    // req.user এ user info রাখো
    req.user = { id: user._id.toString(), user_phone: user.user_phone };
    next();
  } catch (error) {
    next(error);
  }
};
