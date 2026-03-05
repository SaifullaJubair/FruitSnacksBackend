import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { ISettingInterface } from "./setting.interface";
import {
  getSettingServices,
  postSettingServices,
  updateSettingServices,
} from "./setting.services";

// Add A Setting
export const postSetting: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<ISettingInterface | any> => {
  try {
    const data = req.body;
    if (data?._id) {
      const result = await updateSettingServices(data);
      if (result?.modifiedCount) {
        return sendResponse(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Setting Update successfully !",
        });
      } else {
        throw new ApiError(400, "Setting Update failed !");
      }
    } else {
      const result = await postSettingServices(data);
      if (result) {
        return sendResponse(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Setting Update successfully !",
        });
      } else {
        throw new ApiError(400, "Setting Update failed !");
      }
    }
  } catch (error: any) {
    next(error);
  }
};

// get A Setting
export const getSetting: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<ISettingInterface | any> => {
  try {
    const result = await getSettingServices();
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Setting Get successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// get A ZoneData
export const getZoneData: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { city_id } = req.query;
    if (!city_id) {
      return sendResponse(res, {
        statusCode: httpStatus.BAD_REQUEST,
        success: false,
        message: "City ID is required !",
      });
    }
    const response = await fetch(
      "https://api-hermes.pathao.com/aladdin/api/v1/issue-token",

      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.PATHAO_CLIENT_ID,
          client_secret: process.env.PATHAO_CLIENT_SECRET,
          grant_type: "password",
          username: process.env.PATHAO_USERNAME,
          password: process.env.PATHAO_PASSWORD,
        }),
      },
    );

    const result = await response.json();
    // city data
    const zoneData = await fetch(
      `https://api-hermes.pathao.com/aladdin/api/v1/cities/${city_id}/zone-list`,
      {
        method: "get",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${result?.access_token}`, // Replace access_token with actual token
        },
      },
    );

    // Parse zoneData
    const zoneResult = await zoneData.json();
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Setting Get successfully !",
      data: zoneResult?.data?.data,
    });
  } catch (error: any) {
    next(error);
  }
};
