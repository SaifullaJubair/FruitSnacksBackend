import VariationModel from "./variation.model";
import { IVariationInterface } from "./variation.interface";

export const findVariationsByProductService = async (productId: string) => {
  return VariationModel.find({ product_id: productId }).lean();
};

export const updateVariationService = async (
  _id: string,
  data: Partial<IVariationInterface>,
) => {
  return VariationModel.updateOne({ _id }, data, { runValidators: true });
};
