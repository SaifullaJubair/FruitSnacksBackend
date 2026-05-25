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
    // Single leaf category in the nested tree. category_path = ancestor ids
    // (root → … → parent of this leaf) copied from the category at assign time,
    // enabling subtree filtering ("all products under node X") without joins.
    category_id: {
      type: Schema.Types.ObjectId,
      ref: "categories",
      required: true,
      index: true,
    },
    category_path: [
      {
        type: Schema.Types.ObjectId,
        ref: "categories",
      },
    ],
    brand_id: {
      type: Schema.Types.ObjectId,
      ref: "brands",
    },
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

    // ── Structured attribute engine (Phase 1) ──
    // Chosen attribute values by id (→ attributes collection). Single source of
    // truth for both the PDP spec table and the filter facets. value_ids is
    // indexed so the filter can match products by value without a join.
    product_attributes: [
      {
        _id: false,
        attribute_id: {
          type: Schema.Types.ObjectId,
          ref: "attributes",
          index: true,
        },
        value_ids: [
          {
            type: Schema.Types.ObjectId,
            index: true,
          },
        ],
      },
    ],
    // Which attributes form variation combinations (subset of product_attributes).
    variant_axes: [
      {
        _id: false,
        attribute_id: {
          type: Schema.Types.ObjectId,
          ref: "attributes",
        },
        is_mandatory: {
          type: Boolean,
          default: true,
        },
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
    // Small badge overlaid on the hero image corner (e.g. "নতুন", "বেস্ট সেলার").
    hero_corner_badge: { type: String },
    // Custom heading for the VideoSection ("দেখুন কিভাবে তৈরি হয়" area).
    video_title: { type: String },
    // Optional accent images sitting next to the Benefits / Use Cases cards.
    // Fall back to main_image on the storefront when not set. _key fields are
    // the S3 keys (used for deletion).
    benefits_side_image: { type: String },
    benefits_side_image_key: { type: String },
    use_cases_side_image: { type: String },
    use_cases_side_image_key: { type: String },
    faq_side_image: { type: String },
    faq_side_image_key: { type: String },

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

    // Fully free-form nutrition: admin adds any rows (table) + info tiles.
    nutrition: {
      type: {
        per_serving: String, // optional heading shown next to "পুষ্টি তথ্য"
        rows: [
          {
            _id: false,
            label: { type: String },
            value: { type: String },
          },
        ],
        info_tiles: [
          {
            _id: false,
            label: { type: String },
            value: { type: String },
            icon_key: { type: String },
          },
        ],
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

    // Per-product floating accent images (transparent PNG/WebP). Placement is
    // percentage-based so it stays responsive. vertical = "" → auto-distribute.
    floating_images: [
      {
        _id: false,
        asset_url: { type: String },
        asset_key: { type: String },
        vertical: { type: String }, // "10" | "25" | "40" | "55" | "70" | "85" | "" (auto)
        side: { type: String, enum: ["left", "right"], default: "left" },
        layer: { type: String, enum: ["behind", "front"], default: "behind" },
        size: { type: String, enum: ["sm", "md", "lg"], default: "md" },
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
