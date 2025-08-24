import { Schema, model } from "mongoose";
import { IProductInterface } from "./product.interface";

// Product Schema
const productSchema = new Schema<IProductInterface>(
  {
    product_name: {
      required: true,
      type: String,
    },
    product_slug: {
      required: true,
      type: String,
      unique: true,
    },
    product_sku: {
      type: String,
    },
    product_status: {
      required: true,
      type: String,
      enum: ["active", "in-active"],
      default: "active",
    },
    category_id: {
      type: Schema.Types.ObjectId,
      ref: "categories",
      required: true,
    },
    sub_category_id: {
      type: Schema.Types.ObjectId,
      ref: "subcategories",
    },
    child_category_id: {
      type: Schema.Types.ObjectId,
      ref: "childcategories",
    },
    brand_id: {
      type: Schema.Types.ObjectId,
      ref: "brands",
    },
    specifications: [
      {
        specification_id: {
          type: Schema.Types.ObjectId,
          ref: "attributes",
        },
        specification_values: [
          {
            specification_value_id: {
              type: Schema.Types.ObjectId,
              ref: "attributes",
            },
          },
        ],
      },
    ],
    attributes_details: [
      {
        attribute_name: {
          type: String,
        },
        attribute_values: [
          {
            attribute_value_name: {
              type: String,
            },
            attribute_value_code: {
              type: String,
            },
          },
        ],
      },
    ],
    barcode: {
      type: String,
    },
    barcode_image: {
      type: String,
    },
    description: {
      type: String,
    },
    main_image: {
      type: String,
    },
    main_image_key: {
      type: String,
    },
    size_chart: {
      type: String,
    },
    size_chart_key: {
      type: String,
    },
    main_video: {
      type: String,
    },
    main_video_key: {
      type: String,
    },
    other_images: [
      {
        other_image: {
          type: String,
        },
        other_image_key: {
          type: String,
        },
      },
    ],
    product_price: {
      type: Number,
    },
    product_buying_price: {
      type: Number,
    },
    product_discount_price: {
      type: Number,
    },
    product_quantity: {
      type: Number,
    },
    product_alert_quantity: {
      type: Number,
    },
    is_variation: {
      type: Boolean,
      default: false, // Default value can be added
    },
    product_warrenty: {
      type: String,
    },
    product_return: {
      type: String,
    },
    unit: {
      type: String,
    },
    meta_title: {
      type: String,
    },
    meta_description: {
      type: String,
    },
    meta_keywords: [
      {
        keyword: {
          type: String,
        },
      },
    ],
    product_publisher_id: {
      type: Schema.Types.ObjectId,
      ref: "admins",
      required: true,
    },
    product_updated_by: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
    product_campaign_id: {
      type: Schema.Types.ObjectId,
      ref: "campaigns",
    },
    product_supplier_id: {
      type: Schema.Types.ObjectId,
      ref: "suppliers",
    },
    trending_product: {
      type: Boolean,
      default: true, // Default value can be added
    },
  },
  {
    timestamps: true,
  }
);

const ProductModel = model<IProductInterface>("products", productSchema);

export default ProductModel;
