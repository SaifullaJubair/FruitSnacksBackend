import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import {
  deleteSubscriberServices,
  exportSubscribersCsvServices,
  findAllSubscriberServices,
  subscribeNewsletterServices,
} from "./newsletterSubscriber.services";

// Public — storefront subscription (home / footer / checkout)
export const subscribe: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { contact, channel, source } = req.body;
    if (!contact || !channel) throw new ApiError(400, "contact and channel are required");
    const result = await subscribeNewsletterServices({ contact, channel, source: source || "home" });
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Subscribed successfully",
      data: { _id: result._id, contact: result.contact, channel: result.channel },
    });
  } catch (error: any) {
    next(error);
  }
};

export const findAllSubscribers: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const page = parseInt(req.query.page as string) || 1;
    const skip = (page - 1) * limit;
    const searchTerm = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const { data, total } = await findAllSubscriberServices(limit, skip, searchTerm, status);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Subscribers fetched",
      data,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

export const deleteSubscriber: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const { id } = req.params;
    if (!id) throw new ApiError(400, "Subscriber ID required");
    await deleteSubscriberServices(id);
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Subscriber deleted",
    });
  } catch (error: any) {
    next(error);
  }
};

export const exportSubscribersCsv: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  try {
    const status = req.query.status as string | undefined;
    const rows = await exportSubscribersCsvServices(status);

    const header = "contact,channel,source,status,subscribed_at\n";
    const body = rows
      .map((r) =>
        [
          `"${r.contact}"`,
          r.channel,
          r.source,
          r.status,
          r.subscribed_at ? new Date(r.subscribed_at).toISOString() : "",
        ].join(","),
      )
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="subscribers_${Date.now()}.csv"`,
    );
    return res.send(header + body);
  } catch (error: any) {
    next(error);
  }
};
