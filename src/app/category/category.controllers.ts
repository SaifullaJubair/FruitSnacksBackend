import { NextFunction, Request, RequestHandler, Response } from "express";
import {
  categorySearchableField,
  ICategoryInterface,
} from "./category.interface";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import {
  deleteCategoryServices,
  findAllCategoryServices,
  findAllDashboardCategoryServices,
  getCategorySubChildCategoryServices,
  getSixFeaturedCategoryServices,
  postCategoryServices,
  updateCategoryServices,
} from "./category.services";
import { FileUploadHelper } from "../../helpers/image.upload";
import ApiError from "../../errors/ApiError";
import * as fs from "fs";
import CategoryModel from "./category.model";
import SubCategoryModel from "../sub_category/sub_category.model";
import ChildCategoryModel from "../child_category/child_category.model";
import BrandModel from "../brand/brand.model";
import SpecificationModel from "../specification/specification.model";
import AttributeModel from "../attribute/attribute.model";
import ProductModel from "../product/product.model";

// Get banner match category  subCategory childCategory
export const getCategorySubChildCategory: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ICategoryInterface | any> => {
  try {
    const result: any = await getCategorySubChildCategoryServices();
    return sendResponse<ICategoryInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Category With Sub And Child Category Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Get six featured category
export const getSixFeaturedCategory: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ICategoryInterface | any> => {
  try {
    const result: any = await getSixFeaturedCategoryServices();
    return sendResponse<ICategoryInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Six Featured Category Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Add A Category
export const postCategory: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ICategoryInterface | any> => {
  try {
    if (
      req.files &&
      ("category_logo" in req.files || "category_video" in req.files) &&
      req.body
    ) {
      const requestData = req.body;
      const findCategoryNameExit: boolean | null | undefined | any =
        await CategoryModel.exists({
          category_slug: requestData?.category_slug,
        });
      if (findCategoryNameExit) {
        if (req.files.category_logo[0]) {
          fs.unlinkSync(req.files.category_logo[0].path);
        } else {
          fs.unlinkSync(req.files.category_video[0].path);
        }
        throw new ApiError(400, "Already Added !");
      }
      const findCategorySerialExit: boolean | null | undefined | any =
        await CategoryModel.exists({
          category_serial: requestData?.category_serial,
        });
      if (findCategorySerialExit) {
        if (req.files.category_logo[0]) {
          fs.unlinkSync(req.files.category_logo[0].path);
        } else {
          fs.unlinkSync(req.files.category_video[0].path);
        }
        throw new ApiError(400, "Serial Number Previously Added !");
      }
      if (
        requestData?.feature_category_show == true ||
        requestData?.feature_category_show == "true"
      ) {
        const findFeatureCategoryIsMoreThanSix =
          await CategoryModel.countDocuments({ feature_category_show: true });
        if (findFeatureCategoryIsMoreThanSix >= 6) {
          if (req.files.category_logo[0]) {
            fs.unlinkSync(req.files.category_logo[0].path);
          } else {
            fs.unlinkSync(req.files.category_video[0].path);
          }
          throw new ApiError(400, "Already 6 Feature Selected !");
        }
      }
      if (
        requestData?.explore_category_show == true ||
        requestData?.explore_category_show == "true"
      ) {
        const findExploreCategoryIsMoreThanSix =
          await CategoryModel.countDocuments({ explore_category_show: true });
        if (findExploreCategoryIsMoreThanSix >= 3) {
          if (req.files.category_logo[0]) {
            fs.unlinkSync(req.files.category_logo[0].path);
          } else {
            fs.unlinkSync(req.files.category_video[0].path);
          }
          throw new ApiError(400, "Already 3 Explore Selected !");
        }
      }
      // get the category image and upload
      let category_logo;
      let category_logo_key;
      let category_video;
      let category_video_key;
      if (req.files && "category_logo" in req.files) {
        const categoryImage = req.files["category_logo"][0];
        const category_logo_upload = await FileUploadHelper.uploadToSpaces(
          categoryImage
        );
        category_logo = category_logo_upload?.Location;
        category_logo_key = category_logo_upload?.Key;
      }
      if (req.files && "category_video" in req.files) {
        const categoryImage = req.files["category_video"][0];
        const category_video_upload = await FileUploadHelper.uploadToSpaces(
          categoryImage
        );
        category_video = category_video_upload?.Location;
        category_video_key = category_video_upload?.Key;
      }
      const data = { ...requestData };
      if (category_logo) {
        data.category_logo = category_logo;
        data.category_logo_key = category_logo_key;
      }
      if (category_video) {
        data.category_video = category_video;
        data.category_video_key = category_video_key;
      }
      const result: ICategoryInterface | {} = await postCategoryServices(data);
      if (result) {
        return sendResponse<ICategoryInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Category Added Successfully !",
        });
      } else {
        throw new ApiError(400, "Category Added Failed !");
      }
    } else {
      throw new ApiError(400, "Image Upload Failed");
    }
  } catch (error: any) {
    next(error);
  }
};

// Find All Category
export const findAllCategory: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ICategoryInterface | any> => {
  try {
    const result: ICategoryInterface[] | any = await findAllCategoryServices();
    return sendResponse<ICategoryInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Category Found Successfully !",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All dashboard Category
export const findAllDashboardCategory: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ICategoryInterface | any> => {
  try {
    const { page, limit, searchTerm } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: ICategoryInterface[] | any =
      await findAllDashboardCategoryServices(limitNumber, skip, searchTerm);
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: categorySearchableField.map((field) => ({
          [field]: {
            $regex: searchTerm,
            $options: "i",
          },
        })),
      });
    }
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await CategoryModel.countDocuments(whereCondition);
    return sendResponse<ICategoryInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Category Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update A Category
export const updateCategory: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<ICategoryInterface | any> => {
  try {
    if (
      req.files &&
      ("category_logo" in req.files || "category_video" in req.files) &&
      req.body
    ) {
      const requestData = req.body;
      const findCategoryNameExit: boolean | null | undefined | any =
        await CategoryModel.exists({
          category_slug: requestData?.category_slug,
        });
      if (
        findCategoryNameExit &&
        requestData?._id !== findCategoryNameExit?._id.toString()
      ) {
        if (req.files.category_logo[0]) {
          fs.unlinkSync(req.files.category_logo[0].path);
        } else {
          fs.unlinkSync(req.files.category_video[0].path);
        }
        throw new ApiError(400, "Already Added !");
      }
      const findCategorySerialExit: boolean | null | undefined | any =
        await CategoryModel.exists({
          category_serial: requestData?.category_serial,
        });
      if (
        findCategorySerialExit &&
        requestData?._id !== findCategorySerialExit?._id.toString()
      ) {
        if (req.files.category_logo[0]) {
          fs.unlinkSync(req.files.category_logo[0].path);
        } else {
          fs.unlinkSync(req.files.category_video[0].path);
        }
        throw new ApiError(400, "Serial Number Previously Added !");
      }

      if (requestData?.feature_category_show == true) {
        const findFeatureCategoryIsMoreThanSix = await CategoryModel.find({
          feature_category_show: true,
          _id: { $ne: requestData?._id },
        }).select("_id");
        if (findFeatureCategoryIsMoreThanSix?.length >= 6) {
          if (req.files.category_logo[0]) {
            fs.unlinkSync(req.files.category_logo[0].path);
          } else {
            fs.unlinkSync(req.files.category_video[0].path);
          }
          throw new ApiError(400, "Already 6 Selected !");
        }
      }
      if (requestData?.explore_category_show == true) {
        const findExploreCategoryIsMoreThanThree = await CategoryModel.find({
          explore_category_show: true,
          _id: { $ne: requestData?._id },
        }).select("_id");
        if (findExploreCategoryIsMoreThanThree?.length >= 3) {
          if (req.files.category_logo[0]) {
            fs.unlinkSync(req.files.category_logo[0].path);
          } else {
            fs.unlinkSync(req.files.category_video[0].path);
          }
          throw new ApiError(400, "Already 3 Selected !");
        }
      }
      // get the category image and upload
      // get the category image and upload
      let category_logo;
      let category_logo_key;
      let category_video;
      let category_video_key;
      if (req.files && "category_logo" in req.files) {
        const categoryImage = req.files["category_logo"][0];
        const category_logo_upload = await FileUploadHelper.uploadToSpaces(
          categoryImage
        );
        category_logo = category_logo_upload?.Location;
        category_logo_key = category_logo_upload?.Key;
      }
      if (req.files && "category_video" in req.files) {
        const categoryImage = req.files["category_video"][0];
        const category_video_upload = await FileUploadHelper.uploadToSpaces(
          categoryImage
        );
        category_video = category_video_upload?.Location;
        category_video_key = category_video_upload?.Key;
      }
      const data = { ...requestData };
      if (category_logo) {
        data.category_logo = category_logo;
        data.category_logo_key = category_logo_key;
      }
      if (category_video) {
        data.category_video = category_video;
        data.category_video_key = category_video_key;
      }
      const result: ICategoryInterface | any = await updateCategoryServices(
        data,
        requestData?._id
      );
      if (result?.modifiedCount > 0) {
        if (req.body?.category_logo_key) {
          await FileUploadHelper.deleteFromSpaces(req.body?.category_logo_key);
        }
        if (req.body?.category_video_key) {
          await FileUploadHelper.deleteFromSpaces(req.body?.category_video_key);
        }
        return sendResponse<ICategoryInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Category Update Successfully !",
        });
      } else {
        throw new ApiError(400, "Category Update Failed !");
      }
    } else {
      const requestData = req.body;
      const findCategoryNameExit: boolean | null | undefined | any =
        await CategoryModel.exists({
          category_slug: requestData?.category_slug,
        });
      if (
        findCategoryNameExit &&
        requestData?._id !== findCategoryNameExit?._id.toString()
      ) {
        throw new ApiError(400, "Already Added !");
      }
      const findCategorySerialExit: boolean | null | undefined | any =
        await CategoryModel.exists({
          category_serial: requestData?.category_serial,
        });
      if (
        findCategorySerialExit &&
        requestData?._id !== findCategorySerialExit?._id.toString()
      ) {
        throw new ApiError(400, "Serial Number Previously Added !");
      }
      if (requestData?.feature_category_show == true) {
        const findFeatureCategoryIsMoreThanSix = await CategoryModel.find({
          feature_category_show: true,
          _id: { $ne: requestData?._id },
        }).select("_id");
        if (findFeatureCategoryIsMoreThanSix?.length >= 6) {
          throw new ApiError(400, "Already 6 Selected !");
        }
      }
      if (requestData?.explore_category_show == true) {
        const findFeatureCategoryIsMoreThanSix = await CategoryModel.find({
          explore_category_show: true,
          _id: { $ne: requestData?._id },
        }).select("_id");
        if (findFeatureCategoryIsMoreThanSix?.length >= 3) {
          throw new ApiError(400, "Already 3 Selected !");
        }
      }
      const result: ICategoryInterface | any = await updateCategoryServices(
        requestData,
        requestData?._id
      );
      if (result?.modifiedCount > 0) {
        return sendResponse<ICategoryInterface>(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: "Category Update Successfully !",
        });
      } else {
        throw new ApiError(400, "Category Update Failed !");
      }
    }
  } catch (error: any) {
    next(error);
  }
};

// delete A Category item
export const deleteACategoryInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const category_id = req.body._id;
    const findCategoryInSubCategoryExist: boolean | null | undefined | any =
      await SubCategoryModel.exists({
        category_id: category_id,
      });
    if (findCategoryInSubCategoryExist) {
      throw new ApiError(400, "Already Added In SubCategory !");
    }
    const findCategoryInChildCategoryExist: boolean | null | undefined | any =
      await ChildCategoryModel.exists({
        category_id: category_id,
      });
    if (findCategoryInChildCategoryExist) {
      throw new ApiError(400, "Already Added In ChildCategory !");
    }
    const findCategoryInBrandExist: boolean | null | undefined | any =
      await BrandModel.exists({
        category_id: category_id,
      });
    if (findCategoryInBrandExist) {
      throw new ApiError(400, "Already Added In Brand !");
    }
    const findCategoryInSpecificationExist: boolean | null | undefined | any =
      await SpecificationModel.exists({
        category_id: category_id,
      });
    if (findCategoryInSpecificationExist) {
      throw new ApiError(400, "Already Added In Specification !");
    }
    const findCategoryInAttributeExist: boolean | null | undefined | any =
      await AttributeModel.exists({
        category_id: category_id,
      });
    if (findCategoryInAttributeExist) {
      throw new ApiError(400, "Already Added In Attribute !");
    }
    const findCategoryInProductExist: boolean | null | undefined | any =
      await ProductModel.exists({
        category_id: category_id,
      });
    if (findCategoryInProductExist) {
      throw new ApiError(400, "Already Added In Product !");
    }
    const result = await deleteCategoryServices(category_id);
    if (result?.deletedCount > 0) {
      if (req.body?.category_logo_key) {
        await FileUploadHelper.deleteFromSpaces(req.body?.category_logo_key);
      }
      if (req.body?.category_video_key) {
        await FileUploadHelper.deleteFromSpaces(req.body?.category_video_key);
      }
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Category Delete successfully !",
      });
    } else {
      throw new ApiError(400, "Category delete failed !");
    }
  } catch (error) {
    next(error);
  }
};
