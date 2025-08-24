import {
  attributeSearchableField,
  IAttributeInterface,
} from "./attribute.interface";
import AttributeModel from "./attribute.model";

// Create A Attribute
export const postAttributeServices = async (
  data: IAttributeInterface
): Promise<IAttributeInterface | {}> => {
  const createAttribute = await AttributeModel.create(data);
  return createAttribute;
};

// Find Attribute
export const findAllAttributeServices = async (): Promise<
  IAttributeInterface[]
> => {
  const findAttribute = await AttributeModel.find({})
    .sort({ _id: -1 })
    .select("-__v");
  return findAttribute;
};
// Find Attribute
export const findAllDashboardAttributeServices = async (
  limit: number,
  skip: number,
  searchTerm: any
): Promise<IAttributeInterface[]> => {
  const andCondition = [];
  if (searchTerm) {
    andCondition.push({
      $or: attributeSearchableField.map((field) => ({
        [field]: {
          $regex: searchTerm,
          $options: "i",
        },
      })),
    });
  }
  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};
  const findAttribute = await AttributeModel.find(whereCondition)
    .populate("category_id")
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .select("-__v");
  return findAttribute;
};

// Find Attribute using category_id
export const findAllAttributeUsingCategoryIDServices = async (
  category_id: any
): Promise<IAttributeInterface[]> => {
  const findAttribute = await AttributeModel.find({
    category_id: category_id,
    attribute_status: "active",
  })
    .sort({ _id: -1 })
    .select("-__v");

  // Map attributes to include only active values
  const filteredAttributes = findAttribute
    .map((attribute) => {
      // Filter out inactive attribute values
      const activeValues = attribute.attribute_values.filter(
        (value) => value.attribute_value_status === "active"
      );

      // Return a new object with active values only
      return {
        ...attribute.toObject(), // Convert Mongoose document to plain object
        attribute_values: activeValues, // Update the attribute values to only active ones
      };
    })
    .filter(
      (attribute) => attribute.attribute_values.length > 0 // Ensure at least one active value is present
    );

  return filteredAttributes;
};

// Update a Attribute
export const updateAttributeServices = async (
  data: IAttributeInterface,
  _id: string
): Promise<IAttributeInterface | any> => {
  const updateAttributeInfo: IAttributeInterface | null =
    await AttributeModel.findOne({ _id: _id });
  if (!updateAttributeInfo) {
    throw new Error("Attribute not found");
  }

  //  attribute Values আপডেট করা
  const attributeValuesUpdates = data?.attribute_values?.map((value) => {
    if (value?._id) {
      // _id আছে, এটি আপডেট হবে
      return AttributeModel.updateOne(
        { _id: _id, "attribute_values._id": value?._id }, // এই _id দিয়ে value খুঁজবে
        {
          $set: {
            "attribute_values.$.attribute_value_name":
              value?.attribute_value_name,
            "attribute_values.$.attribute_value_slug":
              value?.attribute_value_slug,
            "attribute_values.$.attribute_value_code":
              value?.attribute_value_code,
            "attribute_values.$.attribute_value_status":
              value?.attribute_value_status,
          },
        },
        { runValidators: true }
      );
    } else {
      // _id নেই, নতুন করে তৈরি হবে
      return AttributeModel.updateOne(
        { _id: _id },
        {
          $push: {
            attribute_values: {
              attribute_value_name: value?.attribute_value_name,
              attribute_value_slug: value?.attribute_value_slug,
              attribute_value_code: value?.attribute_value_code,
              attribute_value_status: value?.attribute_value_status || "active",
            },
          },
        },
        { runValidators: true }
      );
    }
  });

  // সমস্ত আপডেট এবং ক্রিয়েশন প্রক্রিয়াগুলো Promise.all এর মাধ্যমে চালানো হচ্ছে
  await Promise.all(attributeValuesUpdates || []);

  const Attribute = await AttributeModel.updateOne({ _id: _id }, data, {
    runValidators: true,
  });
  return Attribute;
};

// Delete a Attribute
export const deleteAttributeServices = async (
  _id: string
): Promise<IAttributeInterface | any> => {
  const Attribute = await AttributeModel.deleteOne(
    { _id: _id },
    {
      runValidators: true,
    }
  );
  return Attribute;
};
