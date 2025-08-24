import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { IOfferInterface, offerSearchableField } from "./offer.interface";
import { FileUploadHelper } from "../../helpers/image.upload";
import {
  deleteOfferServices,
  findAOfferServices,
  findAllDashboardOfferServices,
  findAllOfferServices,
  findProductToAddOfferServices,
  postOfferServices,
  updateOfferServices,
} from "./offer.services";
import OfferModel from "./offer.model";
import ProductModel from "../product/product.model";
import mongoose, { Types } from "mongoose";
import OfferOrderModel from "../offerOrder/offerOrder.model";

// Add A Offer
export const postOffer: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IOfferInterface | any> => {
  try {
    if (req.files && "offer_image" in req.files && req.body) {
      const requestData = req.body;

      // get the Offer image and upload
      let offer_image;
      let offer_image_key;
      if (req.files && "offer_image" in req.files) {
        const OfferImage = req.files["offer_image"][0];
        const offer_image_upload = await FileUploadHelper.uploadToSpaces(
          OfferImage
        );
        offer_image = offer_image_upload?.Location;
        offer_image_key = offer_image_upload?.Key;
      }
      const data = { ...requestData, offer_image, offer_image_key };
      data.offer_products = JSON.parse(data?.offer_products)?.map(
        (product: {
          offer_discount_price: any;
          offer_product_quantity: any;
          offer_discount_type: any;
          _id: string;
        }) => ({
          offer_product_id: product?._id,
          offer_product_quantity: product?.offer_product_quantity,
          offer_discount_price: product?.offer_discount_price,
          offer_discount_type: product?.offer_discount_type,
        })
      );

      const result: IOfferInterface | {} = await postOfferServices(data);
      if (result) {
        return sendResponse<IOfferInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Offer Added Successfully !",
        });
      } else {
        throw new ApiError(400, "Offer Added Failed !");
      }
    } else {
      throw new ApiError(400, "Image Upload Failed");
    }
  } catch (error: any) {
    next(error);
  }
};

// Find All Offer
export const findAllOffer: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IOfferInterface | any> => {
  try {
    const result: IOfferInterface[] | any = await findAllOfferServices();
    return sendResponse<IOfferInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Offer Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find A Offer
export const findAOffer: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IOfferInterface | any> => {
  try {
    const { _id } = req.params;
    const result: IOfferInterface[] | any = await findAOfferServices(_id);
    return sendResponse<IOfferInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Offer Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All dashboard Offer
export const findAllDashboardOffer: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IOfferInterface | any> => {
  try {
    const { page, limit, searchTerm } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: IOfferInterface[] | any = await findAllDashboardOfferServices(
      limitNumber,
      skip,
      searchTerm
    );
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: offerSearchableField.map((field) => ({
          [field]: {
            $regex: searchTerm,
            $options: "i",
          },
        })),
      });
    }
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await OfferModel.countDocuments(whereCondition);
    return sendResponse<IOfferInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Offer Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All product for Offer
export const findProductToAddOffer: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any | any> => {
  try {
    const { page, limit, searchTerm }: any = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: any[] | any = await findProductToAddOfferServices(
      limitNumber,
      skip,
      searchTerm
    );

    const andCondition: any[] = [];
    if (searchTerm) {
      andCondition.push({
        $or: offerSearchableField.map((field) => ({
          [field]: {
            $regex: searchTerm,
            $options: "i",
          },
        })),
      });
    }
    andCondition.push({ product_status: "active" });
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await ProductModel.countDocuments(whereCondition);
    return sendResponse<any>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Offer Product Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update A Offer
export const updateOffer: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IOfferInterface | any> => {
  try {
    if (req.files && "offer_image" in req.files && req.body) {
      const requestData = req.body;
      let offer_products;
      if (requestData?.offer_products) {
        try {
          offer_products = JSON.parse(requestData?.offer_products)?.map(
            (product: any) => ({
              ...product,
              _id: new mongoose.Types.ObjectId(product?._id),
              offer_product_id: new mongoose.Types.ObjectId(
                product?.offer_product_id
              ),
            })
          );
        } catch (error) {
          throw new ApiError(400, "Invalid `offer_products` format.");
        }
      }
      // get the Offer image and upload
      let offer_image;
      let offer_image_key;
      if (req.files && "offer_image" in req.files) {
        const OfferImage = req.files["offer_image"][0];
        const offer_image_upload = await FileUploadHelper.uploadToSpaces(
          OfferImage
        );
        offer_image = offer_image_upload?.Location;
        offer_image_key = offer_image_upload?.Key;
      }
      const data = {
        ...requestData,
        offer_image,
        offer_image_key,
        offer_products,
      };
      const result: IOfferInterface | any = await updateOfferServices(
        data,
        requestData?._id
      );
      if (result?.modifiedCount > 0) {
        await FileUploadHelper.deleteFromSpaces(requestData?.offer_image_key);
        return sendResponse<IOfferInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Offer Update Successfully !",
        });
      } else {
        throw new ApiError(400, "Offer Update Failed !");
      }
    } else {
      const requestData = req.body;
      const result: IOfferInterface | any = await updateOfferServices(
        requestData,
        requestData?._id
      );
      if (result?.modifiedCount > 0) {
        return sendResponse<IOfferInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Offer Update Successfully !",
        });
      } else {
        throw new ApiError(400, "Offer Update Failed !");
      }
    }
  } catch (error: any) {
    next(error);
  }
};

// delete A Offer item
export const deleteAOfferInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const _id = req.body._id;
    const findOfferInOfferOrderExist: boolean | null | undefined | any =
      await OfferOrderModel.exists({
        offer_id: _id,
      });
    if (findOfferInOfferOrderExist) {
      throw new ApiError(400, "Already Added In Order !");
    }
    const result = await deleteOfferServices(_id);
    if (result?.deletedCount > 0) {
      await FileUploadHelper.deleteFromSpaces(req.body?.offer_image_key);
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Offer Delete successfully !",
      });
    } else {
      throw new ApiError(400, "Offer Delete Failed !");
    }
  } catch (error) {
    next(error);
  }
};
