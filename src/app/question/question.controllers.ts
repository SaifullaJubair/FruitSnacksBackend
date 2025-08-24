import { NextFunction, Request, RequestHandler, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import {
  IQuestionInterface,
  questionSearchableField,
} from "./question.interface";
import {
  deleteQuestionServices,
  findAllDashboardQuestionServices,
  findAllQuestionServices,
  findUserQuestionServices,
  postQuestionServices,
  updateQuestionServices,
} from "./question.services";
import QuestionModel from "./question.model";

// Add A Question
export const postQuestion: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IQuestionInterface | any> => {
  try {
    const requestData = req.body;
    const result: IQuestionInterface | {} = await postQuestionServices(
      requestData
    );
    if (result) {
      return sendResponse<IQuestionInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Question Added Successfully !",
      });
    } else {
      throw new ApiError(400, "Question Added Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};

// Find All Question
export const findAllQuestion: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IQuestionInterface | any> => {
  try {
    const { question_product_id } = req.params;
    const { page, limit }: any = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: IQuestionInterface[] | any = await findAllQuestionServices(
      limitNumber,
      skip,
      question_product_id
    );
    const totalData = await QuestionModel.countDocuments({
      question_product_id: question_product_id,
      question_status: "active",
    });
    return sendResponse<IQuestionInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Question Found Successfully !",
      data: result,
      totalData: totalData,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find AUser Question
export const findUserQuestion: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IQuestionInterface | any> => {
  try {
    const { page, limit, searchTerm, question_user_id }: any = req.query;
    if (!question_user_id) {
      throw new ApiError(400, "question_user_id is required");
    }
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: IQuestionInterface[] | any = await findUserQuestionServices(
      limitNumber,
      skip,
      searchTerm,
      question_user_id
    );
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: questionSearchableField.map((field) => ({
          [field]: {
            $regex: searchTerm,
            $options: "i",
          },
        })),
      });
    }
    andCondition.push({ question_user_id: question_user_id });
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await QuestionModel.countDocuments(whereCondition);
    return sendResponse<IQuestionInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Question Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Find All dashboard Question
export const findAllDashboardQuestion: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IQuestionInterface | any> => {
  try {
    const { page, limit, searchTerm } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const result: IQuestionInterface[] | any =
      await findAllDashboardQuestionServices(limitNumber, skip, searchTerm);
    const andCondition = [];
    if (searchTerm) {
      andCondition.push({
        $or: questionSearchableField.map((field) => ({
          [field]: {
            $regex: searchTerm,
            $options: "i",
          },
        })),
      });
    }
    const whereCondition =
      andCondition.length > 0 ? { $and: andCondition } : {};
    const total = await QuestionModel.countDocuments(whereCondition);
    return sendResponse<IQuestionInterface>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Question Found Successfully !",
      data: result,
      totalData: total,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update A Question
export const updateQuestion: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<IQuestionInterface | any> => {
  try {
    const requestData = req.body;
    const result: IQuestionInterface | any = await updateQuestionServices(
      requestData,
      requestData?._id
    );
    if (result?.modifiedCount > 0) {
      return sendResponse<IQuestionInterface>(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Question Update Successfully !",
      });
    } else {
      throw new ApiError(400, "Question Update Failed !");
    }
  } catch (error: any) {
    next(error);
  }
};

// delete A Question item
export const deleteAQuestionInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const _id = req.body._id;
    const result = await deleteQuestionServices(_id);
    if (result?.deletedCount > 0) {
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Question Delete successfully !",
      });
    } else {
      throw new ApiError(400, "Question delete failed !");
    }
  } catch (error) {
    next(error);
  }
};
