import { Schema, model } from "mongoose";
import { IProductInterface } from "./product.interface";
import ThemeModel from "../theme/theme.model";

const adjustThemeUsage = async (themeId: any, delta: number) => {
  if (!themeId) return;
  try {
    await ThemeModel.updateOne(
      { _id: themeId },
      [
        {
          $set: {
            used_in_products: {
              $max: [{ $add: ["$used_in_products", delta] }, 0],
            },
          },
        },
        {
          $set: { is_deletable: { $eq: ["$used_in_products", 0] } },
        },
      ],
    );
  } catch (e) {
    console.warn("[product] theme usage counter update failed", e);
  }
};

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
    product_slug_history: [
      {
        type: String,
      },
    ],
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
    // specifications: [
    //   {
    //     specification_id: {
    //       type: Schema.Types.ObjectId,
    //       ref: "attributes",
    //     },
    //     specification_values: [
    //       {
    //         specification_value_id: {
    //           type: Schema.Types.ObjectId,
    //           ref: "attributes",
    //         },
    //       },
    //     ],
    //   },
    // ],

    // Fix — এভাবে করো
    specifications: [
      {
        specification_id: {
          type: Schema.Types.ObjectId,
          ref: "specifications", // ✅
        },
        specification_values: [
          {
            specification_value_id: {
              type: Schema.Types.ObjectId,
              ref: "specifications", // ✅
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

    // ===== Dynamic Product Page System =====

    theme_id: {
      type: Schema.Types.ObjectId,
      ref: "themes",
      index: true,
    },
    theme_overrides: {
      type: {
        colors: {
          primary: { type: String },
          page_bg: { type: String },
          accent: { type: String },
        },
        button_style: {
          border_radius: { type: String },
          variant: {
            type: String,
            enum: ["filled", "outlined", "gradient"],
          },
        },
      },
      default: undefined,
      _id: false,
    },

    short_description: { type: String, maxlength: 200 },
    badge_text: { type: String },

    short_features: [
      {
        _id: false,
        icon_url: { type: String },
        icon_key: { type: String },
        text: { type: String },
      },
    ],
    process_steps: [
      {
        _id: false,
        icon_url: { type: String },
        icon_key: { type: String },
        text: { type: String },
      },
    ],

    benefits: [{ type: String }],

    use_cases: [
      {
        _id: false,
        icon_url: { type: String },
        icon_key: { type: String },
        text: { type: String },
      },
    ],

    nutrition: {
      type: {
        per_serving: String,
        calories: String,
        protein: String,
        carbohydrate: String,
        fiber: String,
        sugar: String,
        fat: String,
        vitamin_a: String,
        vitamin_c: String,
        iron: String,
        calcium: String,
        origin: String,
        shelf_life: String,
        certifications: [String],
      },
      default: undefined,
      _id: false,
    },

    faqs: [
      {
        _id: false,
        question: { type: String, required: true },
        answer: { type: String, required: true },
      },
    ],

    og_image: { type: String },
    og_image_key: { type: String },
    og_title: { type: String },
    og_description: { type: String },
  },
  {
    timestamps: true,
  },
);

// Theme usage counter — keep themes.used_in_products in sync
productSchema.post("save", async function (doc: any) {
  if (doc.theme_id) {
    await adjustThemeUsage(doc.theme_id, +1);
  }
});

productSchema.post("findOneAndDelete", async function (doc: any) {
  if (doc?.theme_id) {
    await adjustThemeUsage(doc.theme_id, -1);
  }
});

productSchema.post("deleteOne", { document: true, query: false }, async function (this: any) {
  if (this?.theme_id) {
    await adjustThemeUsage(this.theme_id, -1);
  }
});

// Track theme changes via findOneAndUpdate
productSchema.pre("findOneAndUpdate", async function () {
  const update: any = this.getUpdate();
  const newThemeId = update?.theme_id ?? update?.$set?.theme_id;
  if (newThemeId) {
    const existing: any = await this.model.findOne(this.getQuery()).lean();
    if (existing && String(existing.theme_id) !== String(newThemeId)) {
      // stash old + new on options for post hook
      this.setOptions({
        ...(this.getOptions() || {}),
        _prevThemeId: existing.theme_id,
        _newThemeId: newThemeId,
      });
    }
  }
});

productSchema.post("findOneAndUpdate", async function () {
  const opts: any = this.getOptions();
  if (opts?._prevThemeId) {
    await adjustThemeUsage(opts._prevThemeId, -1);
  }
  if (opts?._newThemeId) {
    await adjustThemeUsage(opts._newThemeId, +1);
  }
});

const ProductModel = model<IProductInterface>("products", productSchema);

export default ProductModel;
