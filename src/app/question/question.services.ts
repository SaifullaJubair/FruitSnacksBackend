import {
  IQuestionInterface,
  questionSearchableField,
} from "./question.interface";
import QuestionModel from "./question.model";

// Create A Question
export const postQuestionServices = async (
  data: IQuestionInterface
): Promise<IQuestionInterface | {}> => {
  const createQuestion: IQuestionInterface | {} = await QuestionModel.create(
    data
  );
  return createQuestion;
};

// Find Question
export const findAllQuestionServices = async (
  limit: number,
  skip: number,
  question_product_id: string
): Promise<IQuestionInterface[] | []> => {
  const findQuestion: IQuestionInterface[] | [] = await QuestionModel.find({
    question_product_id: question_product_id,
    question_status: "active",
  })
    .populate("question_user_id")
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .select("-__v");
  return findQuestion;
};

// Find User Question
export const findUserQuestionServices = async (
  limit: number,
  skip: number,
  searchTerm: any,
  question_user_id: any
): Promise<IQuestionInterface[] | []> => {
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
  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};
  const findQuestion: IQuestionInterface[] | [] = await QuestionModel.find(
    whereCondition
  )
    .populate("question_product_id")
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .select("-__v");
  return findQuestion;
};

// Find User Question
export const findAllDashboardQuestionServices = async (
  limit: number,
  skip: number,
  searchTerm: any
): Promise<IQuestionInterface[] | []> => {
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
  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};
  const findQuestion: IQuestionInterface[] | [] = await QuestionModel.find(
    whereCondition
  )
    .populate(["question_user_id", "question_product_id"])
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .select("-__v");
  return findQuestion;
};

// Update a Question
export const updateQuestionServices = async (
  data: IQuestionInterface,
  _id: string
): Promise<IQuestionInterface | any> => {
  const updateQuestionInfo: IQuestionInterface | null =
    await QuestionModel.findOne({
      _id: _id,
    });
  if (!updateQuestionInfo) {
    return {};
  }
  const Question = await QuestionModel.updateOne({ _id: _id }, data, {
    runValidators: true,
  });
  return Question;
};

// Delete a Question
export const deleteQuestionServices = async (
  _id: string
): Promise<IQuestionInterface | any> => {
  const Question = await QuestionModel.deleteOne(
    { _id: _id },
    {
      runValidators: true,
    }
  );
  return Question;
};
