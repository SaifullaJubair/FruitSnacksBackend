import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { IPaymentWithdrawListInterface, paymentWithdrawListSearchableField } from "./paymentWithdrawList.interface";
import { deletePaymentWithdrawListServices, findAllDashboardPaymentWithdrawListServices, findAllSelfPaymentWithdrawListServices, postPaymentWithdrawListServices, updatePaymentWithdrawListServices } from "./paymentWithdrawList.services";
import PaymentWithdrawListModel from "./paymentWithdrawList.model";
import { Types } from "mongoose";

// Add A PaymentWithdrawList
export const postPaymentWithdrawList: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IPaymentWithdrawListInterface | any> => {
  try {
    const requestData = req.body;
    const result: IPaymentWithdrawListInterface | {} = await postPaymentWithdrawListServices(
      requestData
    );
    if (result) {
      return sendResponse<IPaymentWithdrawListInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "PaymentWithdrawList Added Successfully !",
      });
    } else {
      throw new ApiError(400, "PaymentWithdrawList Added Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};

// Find All dashboard PaymentWithdrawList
export const findAllDashboardPaymentWithdrawList: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IPaymentWithdrawListInterface | any> => {
  try {
    const { page, limit, searchTerm } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: IPaymentWithdrawListInterface[] | any =
      await findAllDashboardPaymentWithdrawListServices(limitNumber, skip, searchTerm);
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: paymentWithdrawListSearchableField.map((field) => ({
          [field]: { $regex: searchTerm, $options: "i" },
        })),
      });
    }

    const whereCondition: any =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await PaymentWithdrawListModel.countDocuments(whereCondition);
    return sendResponse<IPaymentWithdrawListInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "PaymentWithdrawList Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All Self PaymentWithdrawList
export const findAllSelfPaymentWithdrawList: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IPaymentWithdrawListInterface | any> => {
  try {
    const { page, limit, searchTerm, panel_owner_id }: any = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: IPaymentWithdrawListInterface[] | any =
      await findAllSelfPaymentWithdrawListServices(limitNumber, skip, searchTerm, panel_owner_id);
    const panelOwnerIdCondition = Types.ObjectId.isValid(panel_owner_id)
            ? { panel_owner_id: new Types.ObjectId(panel_owner_id) }
            : { panel_owner_id: panel_owner_id };
          const andCondition: any[] = [panelOwnerIdCondition];
    if (searchTerm) {
      andCondition.push({
        $or: paymentWithdrawListSearchableField.map((field) => ({
          [field]: { $regex: searchTerm, $options: "i" },
        })),
      });
    }

    const whereCondition: any =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await PaymentWithdrawListModel.countDocuments(whereCondition);
    return sendResponse<IPaymentWithdrawListInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "PaymentWithdrawList Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update A PaymentWithdrawList
export const updatePaymentWithdrawList: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IPaymentWithdrawListInterface | any> => {
  try {
    const requestData = req.body;
    const result: IPaymentWithdrawListInterface | any = await updatePaymentWithdrawListServices(
      requestData,
      requestData?._id
    );
    if (result?.modifiedCount > 0) {
      return sendResponse<IPaymentWithdrawListInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "PaymentWithdrawList Update Successfully !",
      });
    } else {
      throw new ApiError(400, "PaymentWithdrawList Update Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};

// delete A PaymentWithdrawList item
export const deleteAPaymentWithdrawListInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const _id = req.body._id;
    const result = await deletePaymentWithdrawListServices(_id);
    if (result?.deletedCount > 0) {
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "PaymentWithdrawList Delete Successfully !",
      });
    } else {
      throw new ApiError(400, "PaymentWithdrawList Delete Failed !");
    }
  } catch (error) {
    next(error);
  }
};
