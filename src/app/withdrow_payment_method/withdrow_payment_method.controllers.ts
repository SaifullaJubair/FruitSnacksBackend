import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { FileUploadHelper } from "../../helpers/image.upload";
import ApiError from "../../errors/ApiError";
import * as fs from "fs";
import { Types } from "mongoose";
import { IPaymentMethodInterface, paymentMethodSearchableField } from "./withdrow_payment_method.interface";
import { deletePaymentMethodServices, findAllDashboardPaymentMethodServices, findAllPaymentMethodServices, postPaymentMethodServices, updatePaymentMethodServices } from "./withdrow_payment_method.services";
import PaymentMethodModel from "./withdrow_payment_method.model";

// Add A PaymentMethod
export const postPaymentMethod: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IPaymentMethodInterface | any> => {
  try {
    if (req.files && "payment_method_image" in req.files && req.body) {
      const requestData = req.body; 
      // get the PaymentMethod image and upload
      let payment_method_image;
      let payment_method_image_key;
      if (req.files && "payment_method_image" in req.files) {
        const PaymentMethodImage = req.files["payment_method_image"][0];
        const payment_method_image_upload = await FileUploadHelper.uploadToSpaces(
          PaymentMethodImage
        );
        payment_method_image = payment_method_image_upload?.Location;
        payment_method_image_key = payment_method_image_upload?.Key;
      }
      const data = { ...requestData, payment_method_image, payment_method_image_key };
      const result: IPaymentMethodInterface | {} = await postPaymentMethodServices(data);
      if (result) {
        return sendResponse<IPaymentMethodInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "PaymentMethod Added Successfully !",
        });
      } else {
        throw new ApiError(400, "PaymentMethod Added Failed !");
      }
    } else {
      throw new ApiError(400, "Image Added Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};

// Find All  PaymentMethod
export const findAllPaymentMethod: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IPaymentMethodInterface | any> => {
  try {
    const result: IPaymentMethodInterface[] | any = await findAllPaymentMethodServices();
    const total = await PaymentMethodModel.countDocuments({payment_method_status: "active"});
    return sendResponse<IPaymentMethodInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Payment Method Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All Dashboard PaymentMethod
export const findAllDashboardPaymentMethod: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IPaymentMethodInterface | any> => {
  try {
    const { page, limit, searchTerm } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: IPaymentMethodInterface[] | any = await findAllDashboardPaymentMethodServices(
      limitNumber,
      skip,
      searchTerm
    );

    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: paymentMethodSearchableField.map((field) => ({
          [field]: {
            $regex: searchTerm,
            $options: "i",
          },
        })),
      });
    }
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await PaymentMethodModel.countDocuments(whereCondition);
    return sendResponse<IPaymentMethodInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "PaymentMethod Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update A PaymentMethod
export const updatePaymentMethod: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IPaymentMethodInterface | any> => {
  try {
    if (req.files && "payment_method_image" in req.files && req.body) {
      const requestData = req.body;
      // get the PaymentMethod image and upload
      let payment_method_image;
      let payment_method_image_key;
      if (req.files && "payment_method_image" in req.files) {
        const PaymentMethodImage = req.files["payment_method_image"][0];
        const payment_method_image_upload = await FileUploadHelper.uploadToSpaces(
          PaymentMethodImage
        );
        payment_method_image = payment_method_image_upload?.Location;
        payment_method_image_key = payment_method_image_upload?.Key;
      }
      const data = { ...requestData, payment_method_image, payment_method_image_key };
      const result: IPaymentMethodInterface | any = await updatePaymentMethodServices(
        data,
        requestData?._id
      );
      if (result?.modifiedCount > 0) {
        if (requestData?.payment_method_image_key) {
          await FileUploadHelper.deleteFromSpaces(
            requestData?.payment_method_image_key
          );
        }
        return sendResponse<IPaymentMethodInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "PaymentMethod Update Successfully !",
        });
      } else {
        throw new ApiError(400, "PaymentMethod Update Failed !");
      }
    } else {
      const requestData = req.body;
      const result: IPaymentMethodInterface | any = await updatePaymentMethodServices(
        requestData,
        requestData?._id
      );
      if (result?.modifiedCount > 0) {
        return sendResponse<IPaymentMethodInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "PaymentMethod Update Successfully !",
        });
      } else {
        throw new ApiError(400, "PaymentMethod Update Failed !");
      }
    }
  } catch (error: any) {
    next(error);
  }
};

// delete A PaymentMethod item
export const deleteAPaymentMethodInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const _id = req.body._id;
    const result = await deletePaymentMethodServices(_id);
    if (result?.deletedCount > 0) {
      if (req.body?.payment_method_image_key) {
        await FileUploadHelper.deleteFromSpaces(req.body?.payment_method_image_key);
      }
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "PaymentMethod Delete successfully !",
      });
    } else {
      throw new ApiError(400, "PaymentMethod delete failed !");
    }
  } catch (error) {
    next(error);
  }
};
