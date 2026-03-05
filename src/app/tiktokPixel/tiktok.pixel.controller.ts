import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import sendResponse from "../../shared/sendResponse";
import { sendTikTokEvent } from "./tiktok.pixel.service";

export const trackTikTokEvent: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { event_name, event_id, event_source_url, user_data, properties } =
      req.body;

    // IP + User Agent automatically নাও
    const client_ip_address =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "";
    const client_user_agent = req.headers["user-agent"] || "";

    await sendTikTokEvent({
      event_name,
      event_id,
      event_source_url,
      user_data: {
        ...user_data,
        client_ip_address,
        client_user_agent,
      },
      properties,
    });

    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "TikTok event tracked successfully!",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
