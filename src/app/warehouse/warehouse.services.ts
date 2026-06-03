import ApiError from "../../errors/ApiError";
import WarehouseModel from "./warehouse.model";
import {
  IWarehouseInterface,
  warehouseSearchableField,
} from "./warehouse.interface";

export const postWarehouseServices = async (
  data: IWarehouseInterface,
): Promise<any> => {
  // Only one default warehouse allowed — if this one is default, unset others.
  if (data?.is_default) {
    await WarehouseModel.updateMany({}, { $set: { is_default: false } });
  }
  return WarehouseModel.create(data);
};

export const findAllWarehouseServices = async (
  limit: number,
  skip: number,
  searchTerm: any,
): Promise<any> => {
  const andCondition: any[] = [];
  if (searchTerm) {
    andCondition.push({
      $or: warehouseSearchableField.map((f) => ({
        [f]: { $regex: searchTerm, $options: "i" },
      })),
    });
  }
  const where = andCondition.length ? { $and: andCondition } : {};
  return WarehouseModel.find(where)
    .sort({ is_default: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

export const findAWarehouseServices = async (_id: string): Promise<any> => {
  const r = await WarehouseModel.findById(_id);
  if (!r) throw new ApiError(404, "Warehouse not found");
  return r;
};

export const updateWarehouseServices = async (
  _id: string,
  data: Partial<IWarehouseInterface>,
): Promise<any> => {
  if (data?.is_default) {
    await WarehouseModel.updateMany(
      { _id: { $ne: _id } },
      { $set: { is_default: false } },
    );
  }
  return WarehouseModel.updateOne(
    { _id },
    { $set: data },
    { runValidators: true },
  );
};

export const deleteWarehouseServices = async (_id: string): Promise<any> =>
  WarehouseModel.deleteOne({ _id });

/** Get the active default warehouse (or null if none configured yet). */
export const getDefaultWarehouseServices = async (): Promise<any> =>
  WarehouseModel.findOne({ is_default: true, status: "active" });
