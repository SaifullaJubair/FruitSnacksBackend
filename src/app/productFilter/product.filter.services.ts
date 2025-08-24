import AttributeModel from "../attribute/attribute.model";
import BrandModel from "../brand/brand.model";
import CategoryModel from "../category/category.model";
import ChildCategoryModel from "../child_category/child_category.model";
import {
  IProductInterface,
  productSearchableField,
} from "../product/product.interface";
import ProductModel from "../product/product.model";
import SpecificationModel from "../specification/specification.model";
import SubCategoryModel from "../sub_category/sub_category.model";

// Find All heading sub and child category Data
export const findAllHeadingSub_Child_CategoryDataServices = async (
  categoryType: any,
  sub_categoryType: any,
  child_categoryType: any
): Promise<any> => {
  const findCategoryType = await CategoryModel.findOne({
    category_slug: categoryType,
  });
  const findCategoryTypeId = findCategoryType?._id?.toString();
  if (child_categoryType !== "undefined") {
    return [];
  } else if (sub_categoryType !== "undefined") {
    // let findSubCategoryTypeId: any;
    // const findSubCategoryType = await SubCategoryModel.findOne({
    //   sub_category_slug: sub_categoryType,
    //   category_id: findCategoryTypeId,
    // });

    // findSubCategoryTypeId = findSubCategoryType?._id?.toString();

    // const childCategoryBySubCategory = await ChildCategoryModel.find({
    //   child_category_status: "active",
    //   sub_category_id: findSubCategoryTypeId,
    // }).populate("sub_category_id");
    // return childCategoryBySubCategory;
    return [];
  } else {
    const subCategoryByCategory = await SubCategoryModel.find({
      sub_category_status: "active",
      category_id: findCategoryTypeId,
    }).populate("category_id");

    return subCategoryByCategory;
  }
};

// Find All Side Filtered Data
export const findAllActiveSideFilteredDataServices = async (
  categoryType: any,
  subCategoryType: any,
  childCategoryType: any
): Promise<IProductInterface[] | any> => {
  const findCategoryType = await CategoryModel.findOne({
    category_slug: categoryType,
  });

  const findCategoryTypeId = findCategoryType?._id?.toString();
  let findSubCategoryTypeId: any;
  // let findChildCategoryTypeId: any;
  if (subCategoryType) {
    const findSubCategoryType = await SubCategoryModel.findOne({
      sub_category_slug: subCategoryType,
      category_id: findCategoryTypeId,
    });
    findSubCategoryTypeId = findSubCategoryType?._id?.toString();
  }
  let childCategoryQuery: any = { category_id: findCategoryTypeId };
  // childCategoryQuery.child_category_slug = childCategoryType;

  if (findSubCategoryTypeId) {
    childCategoryQuery.sub_category_id = findSubCategoryTypeId;
  }
  // if (childCategoryType) {
  //   const findChildCategoryType = await ChildCategoryModel.findOne(
  //     childCategoryQuery
  //   );
  //   findChildCategoryTypeId = findChildCategoryType?._id?.toString();
  // }

  // let brandQuery: any = { category_id: findCategoryTypeId };

  // const categoryTypeMatchbrands = await BrandModel.find(brandQuery);
  const categoryTypeMatchbrands = await BrandModel.find({});

  // let filterQuery: any = {
  //   category_id: findCategoryTypeId,
  //   specification_status: "active",
  // };

  // If there's a subcategory filter, include it in the query
  // if (findSubCategoryTypeId) {
  //   filterQuery.$or = [
  //     { sub_category_id: findSubCategoryTypeId },
  //     { sub_category_id: { $exists: false } },
  //   ];
  // }

  // Filter for specifications that have active specification values
  // filterQuery.specification_values = {
  //   $elemMatch: {
  //     specification_value_status: "active", // Only match specifications with active values
  //   },
  // };

  // Fetch the matching data from the database
  // const categoryTypeMatchFilters = await SpecificationModel.find(filterQuery);


  const categoryTypeMatchFilters = await AttributeModel.find({});

  // Post-processing to ensure inactive specification values are excluded
  const filteredCategoryTypeMatchFilters = categoryTypeMatchFilters.map(
    (specification) => {
      specification.attribute_values =
        specification.attribute_values.filter(
          (value) => value.attribute_value_status === "active"
        );
      return specification;
    }
  );

  let productQuery: any = { category_id: findCategoryTypeId };
  productQuery.product_status = "active";

  if (findSubCategoryTypeId) {
    productQuery.sub_category_id = findSubCategoryTypeId;
  }
  // if (findChildCategoryTypeId) {
  //   productQuery.child_category_id = findChildCategoryTypeId;
  // }

  const findProduct = await ProductModel.find(productQuery)
    .sort({ product_price: -1 })
    .limit(1);

  const sendData = {
    maxPriceRange: findProduct?.[0]?.product_price,
    brands: categoryTypeMatchbrands,
    specifications: filteredCategoryTypeMatchFilters,
  };

  return sendData;
};

// Find FilteredProduct
export const findAllActiveFilteredProductServices = async (
  conditions: any,
  filterData: any,
  limitNumber: number,
  skip: number
): Promise<any> => {
  const parsedFilterData = filterData && JSON.parse(filterData);
  const minPrice = (parsedFilterData && parsedFilterData?.min_price) || 0;
  const maxPrice =
    (parsedFilterData && parsedFilterData?.max_price) ||
    Number.MAX_SAFE_INTEGER;
  const availability: any = (parsedFilterData &&
    parsedFilterData?.availability) || [0, 1];
  const filters: any = (parsedFilterData && parsedFilterData?.filters) || {};
  const brands: any = (parsedFilterData && parsedFilterData?.brands) || [];

  // product get condition
  const matchConditions: any = {
    product_status: "active",
  };

  // Add category conditions
  const category = await CategoryModel.findOne({
    category_slug: conditions?.categoryType,
  });
  if (category) matchConditions.category_id = category?._id;

  if (conditions?.sub_categoryType) {
    const subCategory = await SubCategoryModel.findOne({
      sub_category_slug: conditions?.sub_categoryType,
      category_id: matchConditions?.category_id,
    });
    if (subCategory) matchConditions.sub_category_id = subCategory?._id;
  }

  // if (conditions?.child_categoryType) {
  //   const childCategory = await ChildCategoryModel.findOne({
  //     child_category_slug: conditions?.child_categoryType,
  //     category_id: matchConditions?.category_id,
  //     sub_category_id: matchConditions?.sub_category_id,
  //   });
  //   if (childCategory) matchConditions.child_category_id = childCategory?._id;
  // }

  const pipeline: any = [
    {
      $match: matchConditions,
    },
    ...(conditions?.categoryType
      ? []
      : [
          {
            $lookup: {
              from: "categories",
              localField: "category_id",
              foreignField: "_id",
              as: "category",
            },
          },
          {
            $unwind: {
              path: "$category",
              preserveNullAndEmptyArrays: false,
            },
          },
          {
            $match: {
              "category.category_status": "active",
            },
          },
        ]),
    ...(conditions?.sub_categoryType
      ? []
      : [
          {
            $lookup: {
              from: "subcategories",
              localField: "sub_category_id",
              foreignField: "_id",
              as: "sub_category",
            },
          },
          {
            $unwind: {
              path: "$sub_category",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $match: {
              $or: [
                { "sub_category.sub_category_status": "active" },
                { sub_category: null },
              ],
            },
          },
        ]),
    ...(brands.length > 0
      ? [
          {
            $lookup: {
              from: "brands",
              localField: "brand_id",
              foreignField: "_id",
              as: "brand",
            },
          },
          {
            $unwind: {
              path: "$brand",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $match: {
              "brand.brand_slug": { $in: brands }, // Match only specified brands
            },
          },
        ]
      : [
          {
            $lookup: {
              from: "brands",
              localField: "brand_id",
              foreignField: "_id",
              as: "brand",
            },
          },
          {
            $unwind: {
              path: "$brand",
              preserveNullAndEmptyArrays: true,
            },
          },
        ]),
    {
      $lookup: {
        from: "variations",
        localField: "_id",
        foreignField: "product_id",
        as: "variations",
      },
    },
    {
      $addFields: {
        variations: {
          $map: {
            input: "$variations",
            as: "variation",
            in: {
              _id: "$$variation._id",
              variation_name: "$$variation.variation_name",
              product_id: "$$variation.product_id",
              variation_price: "$$variation.variation_price",
              variation_discount_price: "$$variation.variation_discount_price",
              variation_quantity: "$$variation.variation_quantity",
              variation_image: "$$variation.variation_image",
            },
          },
        },
      },
    },
    {
      $lookup: {
        from: "reviews", // Join with reviews collection
        localField: "_id",
        foreignField: "review_product_id",
        as: "reviews",
      },
    },
    {
      $addFields: {
        average_review_rating: {
          $cond: {
            if: { $gt: [{ $size: "$reviews" }, 0] }, // Check if reviews exist
            then: {
              $divide: [
                { $sum: "$reviews.review_ratting" }, // Sum of all review ratings
                { $size: "$reviews" }, // Total number of reviews
              ],
            },
            else: 0, // Default to 0 if no reviews
          },
        },
        total_reviews: { $size: "$reviews" }, // Count of reviews
      },
    },
    {
      $match: {
        $and: [
          {
            $or: [{ "brand.brand_status": "active" }, { brand: null }],
          },
          {
            $or: [
              {
                $and: [
                  { is_variation: false },
                  {
                    product_price: {
                      $gte: minPrice,
                      $lte: maxPrice,
                    },
                  },
                ],
              },
              {
                $and: [
                  { is_variation: true },
                  {
                    variations: {
                      $elemMatch: {
                        variation_price: {
                          $gte: minPrice,
                          $lte: maxPrice,
                        },
                      },
                    },
                  },
                ],
              },
            ],
          },
          ...(availability.length
            ? [
                {
                  $or: [
                    ...(availability.includes(0)
                      ? [
                          {
                            $and: [
                              { is_variation: false },
                              { product_quantity: { $eq: 0 } },
                            ],
                          },
                          {
                            $and: [
                              { is_variation: true },
                              {
                                variations: {
                                  $elemMatch: {
                                    variation_quantity: { $eq: 0 },
                                  },
                                },
                              },
                            ],
                          },
                        ]
                      : []),
                    ...(availability.includes(1)
                      ? [
                          {
                            $and: [
                              { is_variation: false },
                              { product_quantity: { $gt: 0 } },
                            ],
                          },
                          {
                            $and: [
                              { is_variation: true },
                              {
                                variations: {
                                  $elemMatch: {
                                    variation_quantity: { $gt: 0 },
                                  },
                                },
                              },
                            ],
                          },
                        ]
                      : []),
                  ],
                },
              ]
            : []),
          {
            $expr: {
              $and: Object.entries(filters).map(
                ([specId, specValues]: any) => ({
                  $anyElementTrue: {
                    $map: {
                      input: {
                        $filter: {
                          input: "$specifications",
                          as: "spec",
                          cond: {
                            $eq: [
                              "$$spec.specification_id",
                              { $toObjectId: specId },
                            ],
                          },
                        },
                      },
                      as: "matchedSpec",
                      in: {
                        $anyElementTrue: {
                          $map: {
                            input: "$$matchedSpec.specification_values",
                            as: "specValue",
                            in: {
                              $in: [
                                "$$specValue.specification_value_id",
                                specValues?.map((val: any) => ({
                                  $toObjectId: val,
                                })),
                              ],
                            },
                          },
                        },
                      },
                    },
                  },
                })
              ),
            },
          },
        ],
      },
    },
    {
      $project: {
        _id: 1,
        product_name: 1,
        product_slug: 1,
        main_image: 1,
        attributes_details: {
          $let: {
            vars: {
              filteredAttributes: {
                $filter: {
                  input: "$attributes_details",
                  as: "attribute",
                  cond: {
                    $gt: [
                      {
                        $size: {
                          $filter: {
                            input: "$$attribute.attribute_values",
                            as: "value",
                            cond: {
                              $and: [
                                {
                                  $ne: ["$$value.attribute_value_code", null],
                                },
                                {
                                  $ne: [
                                    "$$value.attribute_value_code",
                                    "undefined",
                                  ],
                                },
                                { $ne: ["$$value.attribute_value_code", ""] },
                              ],
                            },
                          },
                        },
                      },
                      0,
                    ],
                  },
                },
              },
            },
            in: {
              $cond: {
                if: { $eq: [{ $size: "$$filteredAttributes" }, 0] },
                then: "$$REMOVE", // Removes `attributes_details` if empty
                else: {
                  $cond: {
                    if: { $eq: [{ $size: "$$filteredAttributes" }, 1] },
                    then: { $arrayElemAt: ["$$filteredAttributes", 0] }, // Send as object if length = 1
                    else: "$$filteredAttributes", // Send as array if length > 1
                  },
                },
              },
            },
          },
        },
        product_price: 1,
        product_discount_price: 1,
        createdAt: 1,
        updatedAt: 1,
        brand: {
          _id: 1,
          brand_name: 1,
          brand_slug: 1,
        },
        is_variation: 1,
        variations: {
          $cond: {
            if: { $eq: ["$is_variation", true] },
            then: { $arrayElemAt: ["$variations", 0] },
            else: {},
          },
        },
        average_review_rating: 1,
        total_reviews: 1,
      },
    },
  ];

  const findFilterProduct: any = await ProductModel.aggregate([
    ...pipeline,
    {
      $skip: skip,
    },
    {
      $limit: limitNumber,
    },
  ]);

  // Get the total count of products matching the conditions
  const totalCount = await ProductModel.aggregate([
    ...pipeline,
    {
      $count: "total",
    },
  ]);

  return {
    totalData: totalCount[0]?.total || 0,
    filteredData: findFilterProduct,
  };
};

// search product
export const findAllSearchTermProductServices = async (
  limit: any,
  skip: any,
  searchTerm: any
): Promise<any> => {
  const andCondition = [];
  if (searchTerm) {
    andCondition.push({
      $or: productSearchableField.map((field) => ({
        [field]: {
          $regex: searchTerm,
          $options: "i",
        },
      })),
    });
  }
  andCondition.push({ product_status: "active" });

  const whereCondition = andCondition.length > 0 ? { $and: andCondition } : {};

  // Step 1: Count total data
  const totalData = await ProductModel.aggregate([
    {
      $match: whereCondition,
    },
    {
      $lookup: {
        from: "categories",
        localField: "category_id",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $unwind: {
        path: "$category",
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $lookup: {
        from: "subcategories",
        localField: "sub_category_id",
        foreignField: "_id",
        as: "sub_category",
      },
    },
    {
      $unwind: {
        path: "$sub_category",
        preserveNullAndEmptyArrays: true,
      },
    },
    // {
    //   $lookup: {
    //     from: "childcategories",
    //     localField: "child_category_id",
    //     foreignField: "_id",
    //     as: "child_category",
    //   },
    // },
    // {
    //   $unwind: {
    //     path: "$child_category",
    //     preserveNullAndEmptyArrays: true,
    //   },
    // },
    {
      $lookup: {
        from: "brands",
        localField: "brand_id",
        foreignField: "_id",
        as: "brand",
      },
    },
    {
      $unwind: {
        path: "$brand",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $match: {
        "category.category_status": "active",
        $and: [
          {
            $or: [
              { "sub_category.sub_category_status": "active" },
              { sub_category: null },
            ],
          },
          // {
          //   $or: [
          //     { "child_category.child_category_status": "active" },
          //     { child_category: null },
          //   ],
          // },
          {
            $or: [{ "brand.brand_status": "active" }, { brand: null }],
          },
        ],
      },
    },
    {
      $count: "total",
    },
  ]);

  // Extract the total count
  const totalCount = totalData.length > 0 ? totalData[0].total : 0;

  // Step 2: Fetch paginated data
  const findAllSearchProductProduct = await ProductModel.aggregate([
    {
      $match: whereCondition,
    },
    {
      $lookup: {
        from: "categories",
        localField: "category_id",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $unwind: {
        path: "$category",
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $lookup: {
        from: "subcategories",
        localField: "sub_category_id",
        foreignField: "_id",
        as: "sub_category",
      },
    },
    {
      $unwind: {
        path: "$sub_category",
        preserveNullAndEmptyArrays: true,
      },
    },
    // {
    //   $lookup: {
    //     from: "childcategories",
    //     localField: "child_category_id",
    //     foreignField: "_id",
    //     as: "child_category",
    //   },
    // },
    // {
    //   $unwind: {
    //     path: "$child_category",
    //     preserveNullAndEmptyArrays: true,
    //   },
    // },
    {
      $lookup: {
        from: "brands",
        localField: "brand_id",
        foreignField: "_id",
        as: "brand",
      },
    },
    {
      $unwind: {
        path: "$brand",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "variations",
        localField: "_id",
        foreignField: "product_id",
        as: "variations",
      },
    },
    {
      $addFields: {
        variations: {
          $map: {
            input: "$variations",
            as: "variation",
            in: {
              _id: "$$variation._id",
              variation_name: "$$variation.variation_name",
              product_id: "$$variation.product_id",
              variation_price: "$$variation.variation_price",
              variation_discount_price: "$$variation.variation_discount_price",
              variation_quantity: "$$variation.variation_quantity",
              variation_image: "$$variation.variation_image",
            },
          },
        },
      },
    },
    {
      $lookup: {
        from: "reviews", // Join with reviews collection
        localField: "_id",
        foreignField: "review_product_id",
        as: "reviews",
      },
    },
    {
      $addFields: {
        average_review_rating: {
          $cond: {
            if: { $gt: [{ $size: "$reviews" }, 0] }, // Check if reviews exist
            then: {
              $divide: [
                { $sum: "$reviews.review_ratting" }, // Sum of all review ratings
                { $size: "$reviews" }, // Total number of reviews
              ],
            },
            else: 0, // Default to 0 if no reviews
          },
        },
        total_reviews: { $size: "$reviews" }, // Count of reviews
      },
    },
    {
      $match: {
        "category.category_status": "active",
        $and: [
          {
            $or: [
              { "sub_category.sub_category_status": "active" },
              { sub_category: null },
            ],
          },
          {
            $or: [
              { "child_category.child_category_status": "active" },
              { child_category: null },
            ],
          },
          {
            $or: [{ "brand.brand_status": "active" }, { brand: null }],
          },
        ],
      },
    },
    // {
    //   $lookup: {
    //     from: "campaigns",
    //     localField: "product_campaign_id",
    //     foreignField: "_id",
    //     as: "campaign",
    //   },
    // },
    // {
    //   $unwind: {
    //     path: "$campaign",
    //     preserveNullAndEmptyArrays: true,
    //   },
    // },
    // {
    //   $addFields: {
    //     campaign_details: {
    //       $cond: {
    //         if: {
    //           $and: [
    //             { $ne: ["$campaign", null] }, // Check if campaign exists
    //             { $ne: ["$campaign.campaign_products", null] },
    //             { $eq: ["$campaign.campaign_status", "active"] }, // Check if campaign_status is active
    //             {
    //               $gt: [
    //                 {
    //                   $size: {
    //                     $filter: {
    //                       input: "$campaign.campaign_products",
    //                       as: "product",
    //                       cond: {
    //                         $and: [
    //                           {
    //                             $eq: ["$$product.campaign_product_id", "$_id"],
    //                           }, // Match product ID
    //                           {
    //                             $eq: [
    //                               "$$product.campaign_product_status",
    //                               "active",
    //                             ],
    //                           }, // Check product status is active
    //                         ],
    //                       },
    //                     },
    //                   },
    //                 },
    //                 0,
    //               ],
    //             }, // Ensure at least one matching campaign product exists
    //           ],
    //         },
    //         then: {
    //           _id: "$campaign._id",
    //           campaign_start_date: "$campaign.campaign_start_date",
    //           campaign_end_date: "$campaign.campaign_end_date",
    //           campaign_status: "$campaign.campaign_status",
    //           campaign_product: {
    //             $arrayElemAt: [
    //               {
    //                 $filter: {
    //                   input: "$campaign.campaign_products",
    //                   as: "product",
    //                   cond: {
    //                     $and: [
    //                       { $eq: ["$$product.campaign_product_id", "$_id"] }, // Match product ID
    //                       {
    //                         $eq: [
    //                           "$$product.campaign_product_status",
    //                           "active",
    //                         ],
    //                       }, // Check product status is active
    //                     ],
    //                   },
    //                 },
    //               },
    //               0,
    //             ],
    //           },
    //         },
    //         else: null,
    //       },
    //     },
    //   },
    // },
    {
      $project: {
        _id: 1,
        product_name: 1,
        product_slug: 1,
        main_image: 1,
        product_price: 1,
        product_discount_price: 1,
        createdAt: 1,
        updatedAt: 1,
        brand: {
          _id: 1,
          brand_name: 1,
        },
        is_variation: 1,
        variations: {
          $cond: {
            if: { $eq: ["$is_variation", true] },
            then: { $arrayElemAt: ["$variations", 0] },
            else: {},
          },
        },
        // campaign_details: {
        //   $cond: {
        //     if: { $ne: ["$campaign_details.campaign_product", null] },
        //     then: "$campaign_details",
        //     else: null,
        //   },
        // },
        average_review_rating: 1, // Include average rating
        total_reviews: 1, // Include total reviews coun
      },
    },
    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
  ]);

  // Return both the data and total count
  return {
    data: findAllSearchProductProduct,
    totalData: totalCount,
  };
};
