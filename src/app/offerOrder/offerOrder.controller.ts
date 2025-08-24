import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import {
  IOfferOrderInterface,
  offerOrderSearchableField,
} from "./offerOrder.interface";
import {
  getACustomerAllOfferOrderServices,
  getAOfferOrderWithOfferOrderProductsServices,
  getDashboardOfferOrderServices,
  postOfferOrderServices,
  updateOfferOrderServices,
} from "./offerOrder.service";
import OfferOrderModel from "./offerOrder.model";
import ProductModel from "../product/product.model";
import VariationModel from "../variation/variation.model";
import mongoose from "mongoose";

export const generateInvoiceId = async () => {
  let isUnique = false;
  let uniqueInvoiceId;

  while (!isUnique) {
    // Generate a random alphanumeric string of length 8
    uniqueInvoiceId = Array.from({ length: 8 }, () =>
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".charAt(
        Math.floor(Math.random() * 62)
      )
    ).join("");

    // Check if the generated invoice_id is unique in the database
    const existingOrder = await OfferOrderModel.findOne({
      invoice_id: uniqueInvoiceId,
    });

    // If no existing order found, mark the invoice_id as unique
    if (!existingOrder) {
      isUnique = true;
    }
  }

  return uniqueInvoiceId;
};

// Add A OfferOrder
export const postOfferOrder: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IOfferOrderInterface | any> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const requestData = req.body;
    const { offer_products } = requestData;

    requestData.invoice_id = await generateInvoiceId();

    const result: IOfferOrderInterface | {} = await postOfferOrderServices(
      requestData,
      session
    );
    if (result) {
      for (const offer_product of offer_products) {
        if (!offer_product?.is_variation == false) {
          const productQuantityUpdate = await ProductModel.updateOne(
            {
              _id: offer_product?.offer_product_id,
            },
            {
              $inc: {
                product_quantity: -offer_product?.offer_product_quantity,
              },
            },
            {
              session,
              runValidators: true,
            }
          );
          if (productQuantityUpdate.modifiedCount === 0) {
            throw new ApiError(400, "Order Create Failed!");
          }
        } else {
          const productVariationQuantityUpdate = await VariationModel.updateOne(
            {
              _id: offer_product?.variation_id,
              product_id: offer_product?.offer_product_id,
            },
            {
              $inc: {
                variation_quantity: -offer_product?.offer_product_quantity,
              },
            },
            {
              session,
              runValidators: true,
            }
          );
          if (productVariationQuantityUpdate.modifiedCount === 0) {
            throw new ApiError(400, "Order Create Failed!");
          }
        }
      }
      // Commit transaction
      await session.commitTransaction();
      session.endSession();
      return sendResponse<IOfferOrderInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "OfferOrder Added Successfully !",
      });
    } else {
      throw new ApiError(400, "OfferOrder Added Failed !");
    }
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

// get a OfferOrder
export const getACustomerAllOfferOrder: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IOfferOrderInterface | any> => {
  try {
    const { page, limit, searchTerm, customer_id }: any = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    if (!customer_id) {
      throw new ApiError(400, "Customer id is required");
    }
    const result: IOfferOrderInterface[] | any =
      await getACustomerAllOfferOrderServices(
        limitNumber,
        skip,
        searchTerm,
        customer_id
      );
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: offerOrderSearchableField?.map((field) => ({
          [field]: {
            $regex: searchTerm,
            $options: "i",
          },
        })),
      });
    }
    andCondition.push({ customer_id });
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await OfferOrderModel.countDocuments(whereCondition);
    return sendResponse<IOfferOrderInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "OfferOrder Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// get a order details with order products
export const getAOfferOrderWithOrderProducts: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IOfferOrderInterface | any> => {
  try {
    const { _id }: any = req.params;
    const result: IOfferOrderInterface | any =
      await getAOfferOrderWithOfferOrderProductsServices(_id);
    return sendResponse<IOfferOrderInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "OfferOrder Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All Dashboard OfferOrder
export const findAllDashboardOfferOrder: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IOfferOrderInterface | any> => {
  try {
    const { page, limit, searchTerm } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: IOfferOrderInterface[] | any =
      await getDashboardOfferOrderServices(limitNumber, skip, searchTerm);
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: offerOrderSearchableField.map((field) => ({
          [field]: {
            $regex: searchTerm,
            $options: "i",
          },
        })),
      });
    }
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await OfferOrderModel.countDocuments(whereCondition);
    return sendResponse<IOfferOrderInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "OfferOrder Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update A OfferOrder
export const updateOfferOrder: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IOfferOrderInterface | any> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const requestData = req.body;
    const { offer_products } = requestData;
    if (requestData?.order_status === "cancel") {
      delete requestData?.offer_products;
    }
    // handle OfferOrder status
    const result: IOfferOrderInterface | any = await updateOfferOrderServices(
      requestData,
      requestData?._id,
      session
    );

    if (result?.modifiedCount == 0) {
      throw new ApiError(400, "Order Update Failed !");
    }

    if (offer_products?.length > 0) {
      for (const offer_product of offer_products) {
        if (offer_product?.is_variation == false) {
          const productQuantityUpdate = await ProductModel.updateOne(
            {
              _id: offer_product?.offer_product_id,
            },
            {
              $inc: {
                product_quantity: +offer_product?.offer_product_quantity,
              },
            },
            {
              session,
              runValidators: true,
            }
          );
          if (productQuantityUpdate.modifiedCount === 0) {
            throw new ApiError(400, "Order Update Failed!");
          }
        } else {
          const productVariationQuantityUpdate = await VariationModel.updateOne(
            {
              _id: offer_product?.variation_id,
              product_id: offer_product?.offer_product_id,
            },
            {
              $inc: {
                variation_quantity: +offer_product?.offer_product_quantity,
              },
            },
            {
              session,
              runValidators: true,
            }
          );
          if (productVariationQuantityUpdate.modifiedCount === 0) {
            throw new ApiError(400, "Order Update Failed!");
          }
        }
      }
    }

    // Commit transaction
    await session.commitTransaction();
    session.endSession();
    return sendResponse<IOfferOrderInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "OfferOrder Update Successfully !",
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};
