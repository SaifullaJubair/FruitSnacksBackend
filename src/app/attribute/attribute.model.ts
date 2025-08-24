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
