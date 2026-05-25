import { NextFunction, Request, Response } from "express";
import ApiError from "../errors/ApiError";
import UserModel from "../app/user/user.model";
import { verifyTokenAsync, COOKIE_NAMES } from "../utils/auth.tokens";

interface UserRequest extends Request {
  user?: any;
}

// Phase D: same upgrade as the admin middleware — prefer _id from the token,
// fall back to phone for back-compat with old 1y tokens. Reject refresh-typed
// tokens; reject admin tokens used as user.
export const verifyUserToken = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const token = req.cookies?.[COOKIE_NAMES.ACCESS];
    if (!token) throw new ApiError(401, "Login required!");

    const decoded: any = await verifyTokenAsync(token);
    if (decoded?.kind && decoded.kind !== "access") {
      throw new ApiError(401, "Refresh token cannot be used as access.");
    }
    if (decoded?.who && decoded.who !== "user") {
      throw new ApiError(401, "Not a user token.");
    }

    const user = decoded?._id
      ? await UserModel.findOne({
          _id: decoded._id,
          user_status: "active",
        }).select("-user_password -forgot_otp")
      : await UserModel.findOne({
          user_phone: decoded?.user_phone,
          user_status: "active",
        }).select("-user_password -forgot_otp");

    if (!user) throw new ApiError(401, "Invalid user!");

    req.user = { id: user._id.toString(), user_phone: user.user_phone };
    next();
  } catch (error) {
    next(error);
  }
};
