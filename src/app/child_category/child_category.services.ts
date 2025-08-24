import { childcategorySearchableField, IChildCategoryInterface } from "./child_category.interface";
import ChildCategoryModel from "./child_category.model";


// Create A ChildCategory
export const postChildCategoryServices = async (
  data: IChildCategoryInterface
): Promise<IChildCategoryInterface | {}> => {
  const createChildCategory: IChildCategoryInterface | {} = await ChildCategoryModel.create(
    data
  );
  return createChildCategory;
};

// Find ChildCategory
export const findAllChildCategoryServices = async (): Promise<
  IChildCategoryInterface[] | []
> => {
  const findChildCategory: IChildCategoryInterface[] | [] = await ChildCategoryModel.find({
    child_category_status: "active",
  }).populate(['category_id', 'sub_category_id'])
    .sort({ child_category_serial: 1 })
    .select("-__v");
  return findChildCategory;
};

// Find all dashboard ChildCategory
export const findAllDashboardChildCategoryServices = async (
  limit: number,
  skip: number,
  searchTerm: any
): Promise<IChildCategoryInterface[] | []> => {
  const andCondition = [];
  if (searchTerm) {
    andCondition.push({
      $or: childcategorySearchableField.map((field) => ({
        [field]: {
          $regex: searchTerm,
          $options: "i",
        },
      })),
    });
  }
  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};
  const findChildCategory: IChildCategoryInterface[] | [] =
    await ChildCategoryModel.find(whereCondition)
      .populate(['category_id', 'sub_category_id'])
      .sort({ child_category_serial: 1 })
      .skip(skip)
      .limit(limit)
      .select('-__v')
  return findChildCategory;
};

// Update a ChildCategory
export const updateChildCategoryServices = async (
  data: IChildCategoryInterface,
  _id: string
): Promise<IChildCategoryInterface | any> => {
  const updateChildCategoryInfo: IChildCategoryInterface | null =
    await ChildCategoryModel.findOne({ _id: _id });
  if (!updateChildCategoryInfo) {
    return {};
  }
  const ChildCategory = await ChildCategoryModel.updateOne({ _id: _id }, data, {
    runValidators: true,
  });
  return ChildCategory;
};

// Delete a ChildCategory
export const deleteChildCategoryServices = async (
  _id: string
): Promise<IChildCategoryInterface | any> => {
  const updateChildCategoryInfo: IChildCategoryInterface | null =
    await ChildCategoryModel.findOne({ _id: _id });
  if (!updateChildCategoryInfo) {
    return {};
  }
  const ChildCategory = await ChildCategoryModel.deleteOne(
    { _id: _id },
    {
      runValidators: true,
    }
  );
  return ChildCategory;
};
