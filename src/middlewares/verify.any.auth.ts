import { NextFunction, Request, RequestHandler, Response } from "express";
import ApiError from "../errors/ApiError";
import AdminModel from "../app/adminRegLog/admin.model";
import UserModel from "../app/user/user.model";
import { verifyTokenAsync, COOKIE_NAMES } from "../utils/auth.tokens";

interface AnyAuthRequest extends Request {
  user?: any;
  userId?: string;
}

// "Any authenticated principal" guard.
//
// Accepts EITHER a valid admin token OR a valid storefront-user token (both
// live in the same auth cookie, distinguished by the `who` claim). It proves
// the caller has a real logged-in session — no permission flag is required,
// because the action it protects (uploading an image to the shop's S3 bucket)
// is low-stakes but must not be anonymous.
//
// Why not a plain verifyToken / verifyUserToken: /image_upload is called by
// BOTH the admin panel (settings/product images) and the storefront (a
// logged-in user's profile avatar). verifyToken would 401 the storefront;
// verifyUserToken would 401 every admin upload. This closes the anonymous hole
// without breaking either caller.
export const verifyAnyAuth: RequestHandler = async (
  req: AnyAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const token = req.cookies?.[COOKIE_NAMES.ACCESS];
    if (!token) throw new ApiError(401, "Need Log In !");

    const decoded: any = await verifyTokenAsync(token);
    if (decoded?.kind && decoded.kind !== "access") {
      throw new ApiError(401, "Refresh token cannot be used as access.");
    }

    if (decoded?.who === "user") {
      const user = decoded?._id
        ? await UserModel.findOne({ _id: decoded._id, user_status: "active" })
        : await UserModel.findOne({
            user_phone: decoded?.user_phone,
            user_status: "active",
          });
      if (!user) throw new ApiError(401, "Invalid user!");
      req.user = decoded;
      req.userId = String(user._id);
      return next();
    }

    // Default to admin (older admin tokens may not carry `who`).
    if (!decoded?.who || decoded.who === "admin") {
      const admin = decoded?._id
        ? await AdminModel.findById(decoded._id)
        : await AdminModel.findOne({ admin_phone: decoded?.admin_phone });
      if (!admin || admin.admin_status !== "active") {
        throw new ApiError(401, "Invalid admin!");
      }
      req.user = decoded;
      req.userId = String(admin._id);
      return next();
    }

    throw new ApiError(401, "Not a valid session.");
  } catch (error) {
    next(error);
  }
};
