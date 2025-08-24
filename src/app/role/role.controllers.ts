import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import sendResponse from "../../shared/sendResponse";
import { IRoleInterface } from "./role.interface";
import {
  deleteRoleServices,
  findARoleInUserServices,
  findARoleSlugServices,
  findAllDashboardRoleServices,
  postRoleServices,
  updateRoleServices,
} from "./role.services";
import RoleModel from "./role.model";
import { IAdminInterface } from "../adminRegLog/admin.interface";

// Add A Role
export const postRole: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IRoleInterface | any> => {
  try {
    const requestData = req.body;
    const findRoleIsExistWithName: IRoleInterface | null =
      await findARoleSlugServices(requestData?.role_name);
    if (findRoleIsExistWithName) {
      throw new ApiError(400, "Role Name Previously Added !");
    }
    const result: IRoleInterface | {} = await postRoleServices(requestData);
    if (result) {
      return sendResponse<IRoleInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Role Added Successfully !",
      });
    } else {
      throw new ApiError(400, "Role Added Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};

// Find All dashboard Role
export const findAllDashboardRole: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IRoleInterface | any> => {
  try {
    const result: IRoleInterface[] | any = await findAllDashboardRoleServices();
    const total = await RoleModel.countDocuments();
    return sendResponse<IRoleInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Role Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update A Role
export const updateRole: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IRoleInterface | any> => {
  try {
    const requestData = req.body;
    const findRoleIsExistWithName: IRoleInterface | null =
      await findARoleSlugServices(requestData?.role_name);
    if (
      findRoleIsExistWithName &&
      requestData?._id !== findRoleIsExistWithName?._id.toString()
    ) {
      throw new ApiError(400, "Role Name Previously Added !");
    }
    const result: IRoleInterface | any = await updateRoleServices(
      requestData,
      requestData?._id
    );
    if (result?.modifiedCount > 0) {
      return sendResponse<IRoleInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Role Update Successfully !",
      });
    } else {
      throw new ApiError(400, "Role Update Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};

// Delete aRole
export const deleteARole: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IRoleInterface | any> => {
  try {
    const data = req.body;
    const _id = data?._id;
    const roleExistInUser: IAdminInterface[] | any =
      await findARoleInUserServices(_id);
    if (roleExistInUser) {
      throw new ApiError(400, "Role Exist In User Registration !");
    }
    const result: IRoleInterface[] | any = await deleteRoleServices(_id);

    if (result?.deletedCount > 0) {
      return sendResponse<IRoleInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Role Delete Successfully !",
      });
    } else {
      throw new ApiError(400, "Role Delete Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};
