import { NextFunction, Request, RequestHandler, Response } from "express";
import { sendMetaEvent } from "./meta.pixel.service";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";

// Frontend থেকে event receive করো এবং CAPI তে forward করো
export const trackMetaEvent: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { event_name, event_id, event_source_url, user_data, custom_data } =
      req.body;

    if (!event_name || !event_id) {
      return sendResponse(res, {
        statusCode: httpStatus.BAD_REQUEST,
        success: false,
        message: "event_name and event_id required",
      });
    }

    // Client IP আর User Agent server থেকে নাও — বেশি accurate
    const clientIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "";

    const clientUserAgent = req.headers["user-agent"] || "";

    await sendMetaEvent({
      event_name,
      event_id,
      event_source_url,
      action_source: "website",
      user_data: {
        ...user_data,
        client_ip_address: clientIp,
        client_user_agent: clientUserAgent,
      },
      custom_data,
    });

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Event tracked",
    });
  } catch (error) {
    next(error);
  }
};
