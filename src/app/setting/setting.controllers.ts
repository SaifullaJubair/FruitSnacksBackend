import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { ISettingInterface } from "./setting.interface";
import {
  getSettingServices,
  getSettingWithSecretsServices,
  getHomeLayoutSettingServices,
  updateHomeLayoutSettingServices,
  postSettingServices,
  updateSettingSecretsServices,
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

// S4+S5 Phase 1A — admin-only secret accessors. Guarded by
// verifyToken("setting_secrets_update") in routes.ts.
export const getSettingSecrets: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const result = await getSettingWithSecretsServices();
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Setting (with secrets) fetched",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateSettingSecrets: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const result = await updateSettingSecretsServices(req.body || {});
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Secrets updated",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// H-B — send a test email so admin can verify SMTP config before going live
export const sendTestEmail: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { to } = req.body;
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      throw new ApiError(400, "Valid recipient email required!");
    }
    const { SendEmailOTP } = require("../../middlewares/send.otp.email");
    const sent = await SendEmailOTP(123456, to, "Admin", { ignoreEnabledFlag: true });
    if (!sent) {
      throw new ApiError(503, "Email could not be sent. Check your SMTP settings (host, port, username, password).");
    }
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Test email sent successfully! Check your inbox.",
    });
  } catch (error: any) {
    next(error);
  }
};

// Track D — Home Layout: GET + PATCH /setting/home_layout
export const getHomeLayout: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const result = await getHomeLayoutSettingServices();
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Home layout settings fetched",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateHomeLayout: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const result = await updateHomeLayoutSettingServices(req.body || {});
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Home layout settings updated",
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.PATHAO_CLIENT_ID,
          client_secret: process.env.PATHAO_CLIENT_SECRET,
          grant_type: "password",
          username: process.env.PATHAO_CLIENT_EMAIL, 
          password: process.env.PATHAO_CLIENT_PASSWORD, 
        }),
      },
    );

    const result = await response.json();
    console.log("Pathao token result:", JSON.stringify(result));
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
    console.log("Zone API response:", JSON.stringify(zoneResult));

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
