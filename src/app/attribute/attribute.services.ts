import {
  attributeSearchableField,
  IAttributeInterface,
} from "./attribute.interface";
import AttributeModel from "./attribute.model";
import ProductModel from "../product/product.model";

// B2 (2026-06-04) — shared usage-count helper. Used by both the admin
// "this change will affect N products" warning (getAttributeUsageCount) AND
// the delete guard so the two never drift on what counts as "in use".
// Returns up to 10 sample product ids the admin can deep-link to.
export const countProductsUsingAttribute = async (
  attribute_id: string,
): Promise<{ count: number; sample_ids: string[] }> => {
  const count = await ProductModel.countDocuments({
    "product_attributes.attribute_id": attribute_id,
  });
  if (count === 0) return { count: 0, sample_ids: [] };
  const sample = await ProductModel.find({
    "product_attributes.attribute_id": attribute_id,
  })
    .select("_id")
    .limit(10)
    .lean();
  return {
    count,
    sample_ids: sample.map((p: any) => String(p._id)),
  };
};

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

  // Phase E audit BLOCKER fix — single $set write for the whole document.
  // Previously this ran per-value $set / $push and THEN a bulk
  // `updateOne(_id, data, ...)` that overwrote `attribute_values` again. That
  // second overwrite silently dropped any field the per-value $set didn't
  // explicitly list (notably `weight_grams_value`), so editing an attribute
  // without re-sending weights wiped them from the DB.
  //
  // The audit's recommended pattern: do one $set with the full new
  // attribute_values array plus the top-level scalar fields. Mongoose will
  // assign fresh subdoc _ids for entries that don't have one (this matches
  // the previous $push behaviour for newly-added values from the inline
  // "+ Add value" flow). Existing values keep their _id because the caller
  // includes it in the payload.
  const $set: Record<string, any> = {};
  if (data?.attribute_name !== undefined)
    $set.attribute_name = data.attribute_name;
  if (data?.attribute_slug !== undefined)
    $set.attribute_slug = data.attribute_slug;
  if (data?.attribute_status !== undefined)
    $set.attribute_status = data.attribute_status;
  if (data?.display_type !== undefined) $set.display_type = data.display_type;
  if (data?.tracks_weight !== undefined)
    $set.tracks_weight = data.tracks_weight;
  if (data?.attribute_updated_by !== undefined)
    $set.attribute_updated_by = data.attribute_updated_by;
  if (Array.isArray(data?.attribute_values)) {
    // Ensure every value carries all the fields we care about — including
    // `weight_grams_value` — so the overwrite is the SAME shape as the
    // existing doc, no fields ghost-dropped.
    $set.attribute_values = data.attribute_values.map((v: any) => ({
      ...(v?._id ? { _id: v._id } : {}),
      attribute_value_name: v?.attribute_value_name,
      attribute_value_slug: v?.attribute_value_slug,
      attribute_value_code: v?.attribute_value_code,
      attribute_value_status: v?.attribute_value_status || "active",
      ...(v?.weight_grams_value !== undefined
        ? { weight_grams_value: v.weight_grams_value }
        : {}),
    }));
  }

  const Attribute = await AttributeModel.updateOne(
    { _id: _id },
    { $set },
    { runValidators: true }
  );
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
