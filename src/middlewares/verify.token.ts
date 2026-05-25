import { NextFunction, Request, RequestHandler, Response } from "express";
import ApiError from "../errors/ApiError";
import AdminModel from "../app/adminRegLog/admin.model";
import { checkAdminExitsForVerify } from "../app/adminRegLog/admin.services";
import { verifyTokenAsync, COOKIE_NAMES } from "../utils/auth.tokens";

// Extend Request interface to include user property
interface UserRequest extends Request {
  user?: any;
  userId?: string;
}

// Phase D: decode token, prefer _id lookup (new payload), fall back to phone
// (old 1-year tokens still floating around browsers). Always confirm status +
// permission against fresh DB data — admins can be deactivated mid-session.
export const verifyToken = (permission: string): RequestHandler => {
  return async (
    req: UserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<any> => {
    try {
      const cookieToken = req.cookies?.[COOKIE_NAMES.ACCESS];
      if (!cookieToken) throw new ApiError(401, "Need Log In !");
      if (!permission) throw new ApiError(400, "Role Type Required !");

      const decoded: any = await verifyTokenAsync(cookieToken);
      if (decoded?.kind && decoded.kind !== "access") {
        throw new ApiError(401, "Refresh token cannot be used as access.");
      }
      if (decoded?.who && decoded.who !== "admin") {
        throw new ApiError(401, "Not an admin token.");
      }

      const verifyUser: any = decoded?._id
        ? await AdminModel.findById(decoded._id).populate("role_id")
        : await checkAdminExitsForVerify(decoded?.admin_phone);

      const roleData = verifyUser?.role_id?.toObject
        ? verifyUser?.role_id?.toObject()
        : verifyUser?.role_id;

      if (
        verifyUser?.admin_status === "active" &&
        roleData?.[permission]
      ) {
        req.user = decoded;
        req.userId = String(verifyUser._id);
        next();
      } else {
        throw new ApiError(403, "Invalid User !");
      }
    } catch (error) {
      next(error);
    }
  };
};
