import {
  IPaymentMethodInterface,
  paymentMethodSearchableField,
} from "./withdrow_payment_method.interface";
import PaymentMethodModel from "./withdrow_payment_method.model";

// Create A PaymentMethod
export const postPaymentMethodServices = async (
  data: IPaymentMethodInterface
): Promise<IPaymentMethodInterface | {}> => {
  const createPaymentMethod: IPaymentMethodInterface | {} =
    await PaymentMethodModel.create(data);
  return createPaymentMethod;
};

// Find all PaymentMethod
export const findAllPaymentMethodServices = async (): Promise<
  IPaymentMethodInterface[] | []
> => {
  const findPaymentMethod: IPaymentMethodInterface[] | [] =
    await PaymentMethodModel.find({payment_method_status: "active"}).sort({ _id: -1 }).select("-__v");
  return findPaymentMethod;
};

// Find all Dashboard PaymentMethod
export const findAllDashboardPaymentMethodServices = async (
  limit: number,
  skip: number,
  searchTerm: any
): Promise<IPaymentMethodInterface[] | []> => {
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
  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};
  const findPaymentMethod: IPaymentMethodInterface[] | [] =
    await PaymentMethodModel.find(whereCondition)
      .populate("payment_method_publisher_id")
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit)
      .select("-__v");
  return findPaymentMethod;
};

// Update a PaymentMethod
export const updatePaymentMethodServices = async (
  data: IPaymentMethodInterface,
  _id: string
): Promise<IPaymentMethodInterface | any> => {
  const updatePaymentMethodInfo: IPaymentMethodInterface | null =
    await PaymentMethodModel.findOne({
      _id: _id,
    });
  if (!updatePaymentMethodInfo) {
    return {};
  }
  const PaymentMethod = await PaymentMethodModel.updateOne({ _id: _id }, data, {
    runValidators: true,
  });
  return PaymentMethod;
};

// Delete a PaymentMethod
export const deletePaymentMethodServices = async (
  _id: string
): Promise<IPaymentMethodInterface | any> => {
  const updatePaymentMethodInfo: IPaymentMethodInterface | null =
    await PaymentMethodModel.findOne({
      _id: _id,
    });
  if (!updatePaymentMethodInfo) {
    return {};
  }
  const PaymentMethod = await PaymentMethodModel.deleteOne(
    { _id: _id },
    {
      runValidators: true,
    }
  );
  return PaymentMethod;
};
