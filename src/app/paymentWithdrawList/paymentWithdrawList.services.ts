import { Types } from "mongoose";
import ApiError from "../../errors/ApiError";
import {
  IPaymentWithdrawListInterface,
  paymentWithdrawListSearchableField,
} from "./paymentWithdrawList.interface";
import PaymentWithdrawListModel from "./paymentWithdrawList.model";

// Create A PaymentWithdrawList
export const postPaymentWithdrawListServices = async (
  data: IPaymentWithdrawListInterface
): Promise<IPaymentWithdrawListInterface | {}> => {
  const createPaymentWithdrawList: IPaymentWithdrawListInterface | {} =
    await PaymentWithdrawListModel.create(data);
  return createPaymentWithdrawList;
};

// Find all dashboard PaymentWithdrawList
export const findAllDashboardPaymentWithdrawListServices = async (
  limit: number,
  skip: number,
  searchTerm: any
): Promise<IPaymentWithdrawListInterface[] | []> => {
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

  // Start building the query
  const findPaymentWithdrawList = PaymentWithdrawListModel.find(whereCondition)
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .select("-__v");

  return findPaymentWithdrawList;
};

// Find all Self PaymentWithdrawList
export const findAllSelfPaymentWithdrawListServices = async (
  limit: number,
  skip: number,
  searchTerm: any,
  panel_owner_id: any
): Promise<IPaymentWithdrawListInterface[] | []> => {
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

  // Start building the query
  const findPaymentWithdrawList = PaymentWithdrawListModel.find(whereCondition)
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .select("-__v");

  return findPaymentWithdrawList;
};

// Update a PaymentWithdrawList
export const updatePaymentWithdrawListServices = async (
  data: IPaymentWithdrawListInterface,
  _id: string
): Promise<IPaymentWithdrawListInterface | any> => {
  const updatePaymentWithdrawListInfo: IPaymentWithdrawListInterface | null =
    await PaymentWithdrawListModel.findOne({
      _id: _id,
    });
  if (!updatePaymentWithdrawListInfo) {
    throw new ApiError(400, "Document not found");
  }
  const PaymentWithdrawList = await PaymentWithdrawListModel.updateOne(
    { _id: _id },
    data,
    {
      runValidators: true,
    }
  );
  return PaymentWithdrawList;
};

// Delete a PaymentWithdrawList
export const deletePaymentWithdrawListServices = async (
  _id: string
): Promise<IPaymentWithdrawListInterface | any> => {
  const PaymentWithdrawList = await PaymentWithdrawListModel.deleteOne(
    { _id: _id },
    {
      runValidators: true,
    }
  );
  return PaymentWithdrawList;
};
