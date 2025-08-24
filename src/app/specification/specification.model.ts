import { Schema, model } from "mongoose";
import { ISpecificationInterface } from "./specification.interface";

// Specification Schema
const specificationSchema = new Schema<ISpecificationInterface>(
  {
    specification_name: {
      required: true,
      type: String,
    },
    specification_slug: {
      required: true,
      type: String,
    },
    specification_serial: {
      required: true,
      type: Number,
    },
    specification_status: {
      required: true,
      type: String,
      enum: ["active", "in-active"],
      default: "active",
    },
    specification_show: {
      required: true,
      type: Boolean,
      default: true,
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
    specification_values: [
      {
        specification_value_name: {
          required: true,
          type: String,
        },
        specification_value_slug: {
          required: true,
          type: String,
        },
        specification_value_status: {
          required: true,
          type: String,
          enum: ["active", "in-active"],
          default: "active",
        },
      },
    ],
    specification_publisher_id: {
      type: Schema.Types.ObjectId,
      ref: "admins",
      required: true,
    },
    specification_updated_by: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
  },
  {
    timestamps: true,
  }
);

const SpecificationModel = model<ISpecificationInterface>(
  "specifications",
  specificationSchema
);

export default SpecificationModel;
