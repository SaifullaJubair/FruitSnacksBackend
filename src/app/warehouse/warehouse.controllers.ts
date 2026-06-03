import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import sendResponse from "../../shared/sendResponse";
import {
  postWarehouseServices,
  findAllWarehouseServices,
  findAWarehouseServices,
  updateWarehouseServices,
  deleteWarehouseServices,
  getDefaultWarehouseServices,
} from "./warehouse.services";

export const postWarehouse: RequestHandler = async (req, res, next): Promise<any> => {
  try {
    const r = await postWarehouseServices({
      ...req.body,
      publisher_id: (req as any).userId,
    });
    return sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Warehouse created.", data: r });
  } catch (e) { next(e); }
};

export const findAllWarehouse: RequestHandler = async (req, res, next): Promise<any> => {
  try {
    const { page = 1, limit = 20, searchTerm } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);
    const r = await findAllWarehouseServices(Number(limit), skip, searchTerm);
    return sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Warehouses found.", data: r });
  } catch (e) { next(e); }
};

export const findAWarehouse: RequestHandler = async (req, res, next): Promise<any> => {
  try {
    const r = await findAWarehouseServices(req.params._id);
    return sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Warehouse found.", data: r });
  } catch (e) { next(e); }
};

export const updateWarehouse: RequestHandler = async (req, res, next): Promise<any> => {
  try {
    const r = await updateWarehouseServices(req.params._id, {
      ...req.body,
      updated_by: (req as any).userId,
    });
    return sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Warehouse updated.", data: r });
  } catch (e) { next(e); }
};

export const deleteWarehouse: RequestHandler = async (req, res, next): Promise<any> => {
  try {
    const r = await deleteWarehouseServices(req.params._id);
    return sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Warehouse deleted.", data: r });
  } catch (e) { next(e); }
};

export const findDefaultWarehouse: RequestHandler = async (req, res, next): Promise<any> => {
  try {
    const r = await getDefaultWarehouseServices();
    return sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Default warehouse.", data: r });
  } catch (e) { next(e); }
};
