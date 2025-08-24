import {
  ISpecificationInterface,
  specificationSearchableField,
} from "./specification.interface";
import SpecificationModel from "./specification.model";

// Create A Specification
export const postSpecificationServices = async (
  data: ISpecificationInterface
): Promise<ISpecificationInterface | {}> => {
  const createSpecification = await SpecificationModel.create(data);
  return createSpecification;
};

// Find Specification
export const findAllDashboardSpecificationServices = async (
  limit: number,
  skip: number,
  searchTerm: any
): Promise<ISpecificationInterface[]> => {
  const andCondition = [];
  if (searchTerm) {
    andCondition.push({
      $or: specificationSearchableField.map((field) => ({
        [field]: {
          $regex: searchTerm,
          $options: "i",
        },
      })),
    });
  }
  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};
  const findSpecification = await SpecificationModel.find(whereCondition)
    .populate("category_id")
    .populate("sub_category_id")
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .select("-__v");
  return findSpecification;
};

// Find Specification using category_id
export const findAllSpecificationUsingCategoryIDServices = async (
  category_id: any
): Promise<ISpecificationInterface[]> => {
  const findSpecification = await SpecificationModel.find({
    category_id: category_id,
    specification_status: "active",
  })
    .sort({ _id: -1 })
    .select("-__v");

  // Filter specifications to include only those with active values
  const filteredSpecifications = findSpecification.map(specification => {
    // Filter out inactive specification values
    const activeValues = specification.specification_values.filter(value => 
      value.specification_value_status === "active"
    );

    // Return a new object with active values only
    return {
      ...specification.toObject(), // Convert Mongoose document to plain object
      specification_values: activeValues // Update the specification values to only active ones
    };
  }).filter(specification => 
    specification.specification_values.length > 0 // Ensure at least one active value is present
  );

  return filteredSpecifications;
};



// Update a Specificationexport
export const updateSpecificationServices = async (
  data: ISpecificationInterface,
  _id: string
): Promise<ISpecificationInterface | any> => {
  const updateSpecificationInfo: ISpecificationInterface | null =
    await SpecificationModel.findOne({ _id: _id });
  if (!updateSpecificationInfo) {
    throw new Error("Specification not found");
  }

  // আপডেট করার ডেটা তৈরি করা হচ্ছে
  const updateData: any = { ...data };

  // যদি `sub_category_id` পাঠানো না হয়, তাহলে সেটি ডিলিট করা হবে
  const unsetData: any = {};
  if (!data.hasOwnProperty("sub_category_id")) {
    unsetData.sub_category_id = "";
  }

  // Specification Values আপডেট করা
  const specificationValuesUpdates = data?.specification_values?.map(
    (value) => {
      if (value?._id) {
        // _id আছে, এটি আপডেট হবে
        return SpecificationModel.updateOne(
          { _id: _id, "specification_values._id": value?._id }, // এই _id দিয়ে value খুঁজবে
          {
            $set: {
              "specification_values.$.specification_value_name":
                value?.specification_value_name,
              "specification_values.$.specification_value_slug":
                value?.specification_value_slug,
              "specification_values.$.specification_value_status":
                value?.specification_value_status,
            },
          },
          { runValidators: true }
        );
      } else {
        // _id নেই, নতুন করে তৈরি হবে
        return SpecificationModel.updateOne(
          { _id: _id },
          {
            $push: {
              specification_values: {
                specification_value_name: value?.specification_value_name,
                specification_value_slug: value?.specification_value_slug,
                specification_value_status:
                  value?.specification_value_status || "active",
              },
            },
          },
          { runValidators: true }
        );
      }
    }
  );

  // সমস্ত আপডেট এবং ক্রিয়েশন প্রক্রিয়াগুলো Promise.all এর মাধ্যমে চালানো হচ্ছে
  await Promise.all(specificationValuesUpdates || []);

  const Specification = await SpecificationModel.updateOne(
    { _id: _id },
    {
      $set: updateData, // পাঠানো ফিল্ড আপডেট করা
      $unset: unsetData, // পাঠানো না হলে ফিল্ডগুলো মুছে ফেলা
    },
    { runValidators: true }
  );

  return Specification;
};

// Delete a Specification
export const deleteSpecificationServices = async (
  _id: string
): Promise<ISpecificationInterface | any> => {
  const Specification = await SpecificationModel.deleteOne(
    { _id: _id },
    {
      runValidators: true,
    }
  );
  return Specification;
};
