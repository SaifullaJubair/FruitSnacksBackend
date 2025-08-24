import ApiError from "../../errors/ApiError";
import {
  ICategoryInterface,
  categorySearchableField,
} from "./category.interface";
import CategoryModel from "./category.model";

// Create A Category
export const postCategoryServices = async (
  data: ICategoryInterface
): Promise<ICategoryInterface | {}> => {
  const createCategory: ICategoryInterface | {} = await CategoryModel.create(
    data
  );
  return createCategory;
};

// find category sub category child category
export const getCategorySubChildCategoryServices = async (): Promise<any[]> => {
  const sendData = await CategoryModel.aggregate([
    {
      $match: {
        category_status: { $ne: "in-active" },
        // feature_category_show: true,
      },
    },
    {
      $lookup: {
        from: "subcategories",
        localField: "_id",
        foreignField: "category_id",
        as: "sub_categories",
      },
    },
    {
      $unwind: {
        path: "$sub_categories",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "childcategories",
        localField: "sub_categories._id",
        foreignField: "sub_category_id",
        as: "sub_categories.child_categories",
      },
    },
    {
      $group: {
        _id: "$_id",
        category: { $first: "$$ROOT" },
        sub_categories: {
          $push: {
            $cond: [
              { $ifNull: ["$sub_categories", false] },
              "$sub_categories",
              "$$REMOVE",
            ],
          },
        },
      },
    },
    {
      $addFields: {
        "category.sub_categories": "$sub_categories",
      },
    },
    {
      $unset: ["category.sub_categories"],
    },
    {
      $sort: { "category.category_serial": 1 },
    },
  ]);

  // Sort and clean up subcategories and child categories
  sendData?.forEach((categoryData: any) => {
    // Sort subcategories
    categoryData?.sub_categories?.sort(
      (a: any, b: any) => a?.sub_category_serial - b?.sub_category_serial
    );

    categoryData?.sub_categories?.forEach((subCategoryData: any) => {
      subCategoryData?.child_categories?.sort(
        (a: any, b: any) => a?.child_category_serial - b?.child_category_serial
      );

      if (!subCategoryData?.child_categories?.length) {
        delete subCategoryData.child_categories;
      }
    });

    categoryData.sub_categories = categoryData.sub_categories?.filter(
      (subCategoryData: any) =>
        subCategoryData && Object.keys(subCategoryData).length > 0
    );
  });

  return sendData;
};


// find Six featured category
export const getSixFeaturedCategoryServices = async (): Promise<any[]> => {
  const sendData = await CategoryModel.aggregate([
    {
      $match: {
        category_status: { $ne: "in-active" }, // Include only active categories
        feature_category_show: true, // Include only featured categories
      },
    },
    {
      $lookup: {
        from: "subcategories", // Link subcategories to categories
        localField: "_id",
        foreignField: "category_id",
        as: "sub_categories",
      },
    },
    {
      $unwind: {
        path: "$sub_categories",
        preserveNullAndEmptyArrays: true, // Keep categories without subcategories
      },
    },
    {
      $group: {
        _id: "$_id",
        category: { $first: "$$ROOT" }, // Retain the main category details
        sub_categories: { $push: "$sub_categories" }, // Group subcategories
      },
    },
    {
      $addFields: {
        "category.sub_categories": "$sub_categories",
      },
    },
    {
      $unset: ["category.sub_categories"], // Exclude sub_categories from inside the category object
    },
    {
      $sort: { "category.category_serial": 1 }, // Sort by category serial
    },
  ]);

  // Sort subcategories and child categories
  sendData?.forEach((categoryData: any) => {
    categoryData?.sub_categories?.sort(
      (a: any, b: any) => a?.sub_category_serial - b?.sub_category_serial
    );
  });

  return sendData;
};

// Find Category
export const findAllCategoryServices = async (): Promise<
  ICategoryInterface[] | []
> => {
  const findCategory: ICategoryInterface[] | [] = await CategoryModel.find({
    category_status: "active",
  })
    .sort({ category_serial: 1 })
    .select("-__v");
  return findCategory;
};

// Find all dashboard Category
export const findAllDashboardCategoryServices = async (
  limit: number,
  skip: number,
  searchTerm: any
): Promise<ICategoryInterface[] | []> => {
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
  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};
  const findCategory: ICategoryInterface[] | [] = await CategoryModel.find(
    whereCondition
  )
    .sort({ category_serial: 1 })
    .skip(skip)
    .limit(limit)
    .select("-__v");
  return findCategory;
};

// Update a Category
export const updateCategoryServices = async (
  data: ICategoryInterface,
  _id: string
): Promise<ICategoryInterface | any> => {
  const updateCategoryInfo: ICategoryInterface | null =
    await CategoryModel.findOne({ _id: _id });
  if (!updateCategoryInfo) {
    return {};
  }
  const Category = await CategoryModel.updateOne({ _id: _id }, data, {
    runValidators: true,
  });
  return Category;
};

// Delete a Category
export const deleteCategoryServices = async (
  _id: string
): Promise<ICategoryInterface | any> => {
  const updateCategoryInfo: ICategoryInterface | null =
    await CategoryModel.findOne({ _id: _id });
  if (!updateCategoryInfo) {
    throw new ApiError(404, "Category not found");
  }
  const Category = await CategoryModel.deleteOne(
    { _id: _id },
    {
      runValidators: true,
    }
  );
  return Category;
};
