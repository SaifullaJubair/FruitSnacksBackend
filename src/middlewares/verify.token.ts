import { NextFunction, Request, RequestHandler, Response } from "express";
import ApiError from "../errors/ApiError";
import { promisify } from "util";
import { IUserInterface } from "../app/user/user.interface";
import { checkAdminExitsForVerify } from "../app/adminRegLog/admin.services";
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv").config();

// Extend Request interface to include user property
interface UserRequest extends Request {
  user?: IUserInterface; // Define the type of user property here
}

export const verifyToken = (permission: string): RequestHandler => {
  return async (
    req: UserRequest,
    res: Response,
    next: NextFunction
  ): Promise<any> => {
    try {
      const cokieToken = req.cookies?.artisan_lather_token;
      if (!cokieToken) {
        throw new ApiError(400, "Need Log In !");
      }

      if (!permission) {
        throw new ApiError(400, "Role Type Required !");
      }

      const decoded = await promisify(jwt.verify)(
        cokieToken,
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Im5hem11bEBnbWFpbC5jb20iLCJpYXQiOjE2OTQ0MzExOTF9.xtLPsJrvJ0Gtr4rsnHh1kok51_pU10_hYLilZyBiRAM"
      );
      // const decoded = await promisify(jwt.verify)(token, process.env.ACCESS_TOKEN);

      const admin_phone = decoded?.admin_phone;

      const verifyUser = await checkAdminExitsForVerify(admin_phone);

      // Check if the role_type value in verifyUser.role_id is true
      // const isRoleTypeAllowed = verifyUser?.role_id[permission] === true;

      const roleData = verifyUser?.role_id?.toObject
        ? verifyUser?.role_id?.toObject()
        : verifyUser?.role_id;

      // if (
      //   verifyUser?.admin_phone == admin_phone &&
      //   verifyUser?.admin_status == "active" &&
      //   isRoleTypeAllowed
      // ) {
      if (
        verifyUser?.admin_phone == admin_phone &&
        verifyUser?.admin_status == "active" &&
        roleData?.[permission]
      ) {
        req.user = decoded;
        next();
      } else {
        throw new ApiError(400, "Invalid User !");
      }
    } catch (error) {
      next(error);
    }
  };
};
