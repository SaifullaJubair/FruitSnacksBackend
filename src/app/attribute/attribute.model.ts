import { Schema, model } from "mongoose";
import { IAttributeInterface } from "./attribute.interface";

// attribute Schema
const attributeSchema = new Schema<IAttributeInterface>(
  {
    attribute_name: {
      required: true,
      type: String,
    },
    attribute_slug: {
      required: true,
      type: String,
    },
    attribute_status: {
      required: true,
      type: String,
      enum: ["active", "in-active"],
      default: "active",
    },
    category_id: {
      type: Schema.Types.ObjectId,
      ref: "categories",
      // required: true,
    },
    attribute_values: [
      {
        attribute_value_name: {
          required: true,
          type: String,
        },
        attribute_value_slug: {
          required: true,
          type: String,
        },
        attribute_value_code: {
          type: String,
        },
        attribute_value_status: {
          required: true,
          type: String,
          enum: ["active", "in-active"],
          default: "active",
        },
        // Phase A: per-value weight in grams. Only consumed when the parent
        // attribute has tracks_weight=true. Allowed to be null for values
        // that aren't weight-bearing (e.g. a Color value on a hybrid axis).
        weight_grams_value: {
          type: Number,
          default: null,
        },
      },
    ],
    attribute_publisher_id: {
      type: Schema.Types.ObjectId,
      ref: "admins",
      required: true,
    },
    attribute_updated_by: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
    // Phase A: how this attribute renders in admin + storefront. Defaults
    // are conservative — "button" + no weight tracking. Migration script
    // smart-flips legacy color attributes to "swatch" if any value has a
    // hex code, so PDP doesn't regress between Phase A and Phase C.
    display_type: {
      type: String,
      enum: ["swatch", "button", "dropdown"],
      default: "button",
    },
    tracks_weight: {
      type: Boolean,
      default: false,
    },

    // Demo-seed marker — see product.model.ts. Cleared by "Clear demo data".
    is_demo: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  }
);

const AttributeModel = model<IAttributeInterface>(
  "attributes",
  attributeSchema
);

export default AttributeModel;
