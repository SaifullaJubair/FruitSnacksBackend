import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import sendResponse from "../../shared/sendResponse";
import ApiError from "../../errors/ApiError";
import {
  postFlashSaleServices,
  findAllFlashSaleServices,
  findAFlashSaleServices,
  updateFlashSaleServices,
  deleteFlashSaleServices,
  findActiveFlashSaleStorefrontService,
} from "./flashsale.services";

export const postFlashSale: RequestHandler = async (req, res, next): Promise<any> => {
  try {
    const r = await postFlashSaleServices(req.body);
    return sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Flash sale created.", data: r });
  } catch (e) { next(e); }
};

export const findAllFlashSale: RequestHandler = async (req, res, next): Promise<any> => {
  try {
    const { page = 1, limit = 20, searchTerm } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);
    const r = await findAllFlashSaleServices(Number(limit), skip, searchTerm);
    return sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Flash sales found.", data: r });
  } catch (e) { next(e); }
};

export const findAFlashSale: RequestHandler = async (req, res, next): Promise<any> => {
  try {
    const r = await findAFlashSaleServices(req.params._id);
    return sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Flash sale found.", data: r });
  } catch (e) { next(e); }
};

export const updateFlashSale: RequestHandler = async (req, res, next): Promise<any> => {
  try {
    const r = await updateFlashSaleServices(req.params._id, req.body);
    return sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Flash sale updated.", data: r });
  } catch (e) { next(e); }
};

export const deleteFlashSale: RequestHandler = async (req, res, next): Promise<any> => {
  try {
    const r = await deleteFlashSaleServices(req.params._id);
    return sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Flash sale deleted.", data: r });
  } catch (e) { next(e); }
};

export const findActiveFlashSaleStorefront: RequestHandler = async (req, res, next): Promise<any> => {
  try {
    const r = await findActiveFlashSaleStorefrontService();
    return sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Active flash sale.", data: r });
  } catch (e) { next(e); }
};
