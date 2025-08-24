import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import {
  campaignSearchableField,
  ICampaignInterface,
} from "./campaign.interface";
import {
  deleteCampaignServices,
  findACampaignServices,
  findAllCampaignServices,
  findAllDashboardCampaignServices,
  findProductToAddCampaignServices,
  postCampaignServices,
  updateCampaignServices,
} from "./campaign.services";
import CampaignModel from "./campaign.model";
import { FileUploadHelper } from "../../helpers/image.upload";
import ProductModel from "../product/product.model";
import mongoose, { Types } from "mongoose";
import OrderProductModel from "../orderProducts/orderProduct.model";

// Add A Campaign
export const postCampaign: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ICampaignInterface | any> => {
  try {
    if (req.files && "campaign_image" in req.files && req.body) {
      const requestData = req.body;

      // get the Campaign image and upload
      let campaign_image;
      let campaign_image_key;
      if (req.files && "campaign_image" in req.files) {
        const campaignImage = req.files["campaign_image"][0];
        const campaign_image_upload = await FileUploadHelper.uploadToSpaces(
          campaignImage
        );
        campaign_image = campaign_image_upload?.Location;
        campaign_image_key = campaign_image_upload?.Key;
      }
      const data = { ...requestData, campaign_image, campaign_image_key };
      data.campaign_products = JSON.parse(data?.campaign_products)?.map(
        (product: {
          campaign_product_status: any;
          campaign_product_price: any;
          campaign_price_type: any;
          _id: string;
        }) => ({
          campaign_product_id: product?._id,
          campaign_product_price: product?.campaign_product_price,
          campaign_price_type: product?.campaign_price_type,
          campaign_product_status: product?.campaign_product_status
            ? "active"
            : "in-active",
        })
      );
      const result: ICampaignInterface | {} = await postCampaignServices(data);
      if (result) {
        return sendResponse<ICampaignInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Campaign Added Successfully !",
        });
      } else {
        throw new ApiError(400, "Campaign Added Failed !");
      }
    } else {
      throw new ApiError(400, "Image Upload Failed");
    }
  } catch (error: any) {
    next(error);
  }
};

// Find All Campaign
export const findAllCampaign: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ICampaignInterface | any> => {
  try {
    const result: ICampaignInterface[] | any = await findAllCampaignServices();
    return sendResponse<ICampaignInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Campaign Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find A Campaign
export const findACampaign: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ICampaignInterface | any> => {
  try {
    const { _id } = req.params;
    const result: ICampaignInterface[] | any = await findACampaignServices(_id);
    return sendResponse<ICampaignInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Campaign Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All product for add Campaign
export const findAllDashboardCampaign: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ICampaignInterface | any> => {
  try {
    const { page, limit, searchTerm } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: ICampaignInterface[] | any =
      await findAllDashboardCampaignServices(limitNumber, skip, searchTerm);
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: campaignSearchableField.map((field) => ({
          [field]: {
            $regex: searchTerm,
            $options: "i",
          },
        })),
      });
    }
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await CampaignModel.countDocuments(whereCondition);
    return sendResponse<ICampaignInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Campaign Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All product to add Campaign
export const findProductToAddCampaign: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any | any> => {
  try {
    const { page, limit, searchTerm }: any = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: any[] | any = await findProductToAddCampaignServices(
      limitNumber,
      skip,
      searchTerm
    );
    const andCondition: any[] = [];
    if (searchTerm) {
      andCondition.push({
        $or: campaignSearchableField.map((field) => ({
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
      message: "Campaign Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update A Campaign
export const updateCampaign: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ICampaignInterface | any> => {
  try {
    if (req.files && "campaign_image" in req.files && req.body) {
      const requestData = req.body;
      // get the campaign image and upload
      let campaign_image;
      let campaign_image_key;
      if (req.files && "campaign_image" in req.files) {
        const campaignImage = req.files["campaign_image"][0];
        const campaign_image_upload = await FileUploadHelper.uploadToSpaces(
          campaignImage
        );
        campaign_image = campaign_image_upload?.Location;
        campaign_image_key = campaign_image_upload?.Key;
      }
      const data = { ...requestData, campaign_image, campaign_image_key };
      data.campaign_products = JSON.parse(data?.campaign_products)?.map(
        (product: {
          campaign_product_id: any;
          campaign_product_status: any;
          campaign_product_price: any;
          campaign_price_type: any;
          _id: string;
        }) => ({
          _id: product?._id,
          campaign_product_id: product?.campaign_product_id?._id,
          campaign_product_price: product?.campaign_product_price,
          campaign_price_type: product?.campaign_price_type,
          campaign_product_status: product?.campaign_product_status
            ? "active"
            : "in-active",
        })
      );
      const result: ICampaignInterface | any = await updateCampaignServices(
        data,
        requestData?._id
      );
      if (result?.modifiedCount > 0) {
        await FileUploadHelper.deleteFromSpaces(
          requestData?.campaign_image_key
        );
        return sendResponse<ICampaignInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "campaign Update Successfully !",
        });
      } else {
        throw new ApiError(400, "campaign Update Failed !");
      }
    } else {
      const requestData = req.body;
      const result: ICampaignInterface | any = await updateCampaignServices(
        requestData,
        requestData?._id
      );
      if (result?.modifiedCount > 0) {
        return sendResponse<ICampaignInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "campaign Update Successfully !",
        });
      } else {
        throw new ApiError(400, "campaign Update Failed !");
      }
    }
  } catch (error: any) {
    next(error);
  }
};

// delete A Campaign item
export const deleteACampaignInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { campaign_image_key, _id, campaign_products } = req.body;
    const findCampaignInOrderExist: boolean | null | undefined | any =
      await OrderProductModel.exists({
        campaign_id: _id,
      });
    if (findCampaignInOrderExist) {
      throw new ApiError(400, "Already Added In Order !");
    }

    const result = await deleteCampaignServices(_id, session);
    if (result?.deletedCount > 0) {
      campaign_products?.map(async (product: any) => {
        await ProductModel.updateOne(
          {
            _id: product?.campaign_product_id,
            product_campaign_id: _id,
          },
          { $set: { product_campaign_id: null } },
          { session }
        );
      });
      await FileUploadHelper.deleteFromSpaces(campaign_image_key);
      // Commit transaction
      await session.commitTransaction();
      session.endSession();
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Campaign Delete Successfully !",
      });
    } else {
      throw new ApiError(400, "Campaign delete failed !");
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};
