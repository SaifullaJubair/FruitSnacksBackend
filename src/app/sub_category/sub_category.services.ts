import { ISubCategoryInterface, subcategorySearchableField } from "./sub_category.interface";
import SubCategoryModel from "./sub_category.model";

// Create A SubCategory
export const postSubCategoryServices = async (
  data: ISubCategoryInterface
): Promise<ISubCategoryInterface | {}> => {
  const createSubCategory: ISubCategoryInterface | {} = await SubCategoryModel.create(
    data
  );
  return createSubCategory;
};

// Find SubCategory
export const findAllSubCategoryServices = async (): Promise<
  ISubCategoryInterface[] | []
> => {
  const findSubCategory: ISubCategoryInterface[] | [] = await SubCategoryModel.find({
    sub_category_status: "active",
  }).populate("category_id")
    .sort({ sub_category_serial: 1 })
    .select("-__v");
  return findSubCategory;
};

// Find all dashboard SubCategory
export const findAllDashboardSubCategoryServices = async (
  limit: number,
  skip: number,
  searchTerm: any
): Promise<ISubCategoryInterface[] | []> => {
  const andCondition = [];
  if (searchTerm) {
    andCondition.push({
      $or: subcategorySearchableField.map((field) => ({
        [field]: {
          $regex: searchTerm,
          $options: "i",
        },
      })),
    });
  }
  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};
  const findSubCategory: ISubCategoryInterface[] | [] = await SubCategoryModel.find(
    whereCondition
  ).populate("category_id")
    .sort({ sub_category_serial: 1 })
    .skip(skip)
    .limit(limit)
    .select("-__v");
  return findSubCategory;
};

// Update a SubCategory
export const updateSubCategoryServices = async (
  data: ISubCategoryInterface,
  _id: string
): Promise<ISubCategoryInterface | any> => {
  const updateSubCategoryInfo: ISubCategoryInterface | null =
    await SubCategoryModel.findOne({ _id: _id });
  if (!updateSubCategoryInfo) {
    return {};
  }
  const SubCategory = await SubCategoryModel.updateOne({ _id: _id }, data, {
    runValidators: true,
  });
  return SubCategory;
};

// Delete a SubCategory
export const deleteSubCategoryServices = async (
  _id: string
): Promise<ISubCategoryInterface | any> => {
  const updateSubCategoryInfo: ISubCategoryInterface | null =
    await SubCategoryModel.findOne({ _id: _id });
  if (!updateSubCategoryInfo) {
    return {};
  }
  const SubCategory = await SubCategoryModel.deleteOne(
    { _id: _id },
    {
      runValidators: true,
    }
  );
  return SubCategory;
};
