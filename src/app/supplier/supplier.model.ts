import { Schema, model } from "mongoose";
import { ISupplierInterface } from "./supplier.interface";

// Coupon Schema
const supplierSchema = new Schema<ISupplierInterface>(
  {
    supplier_name: {
      required: true,
      type: String,
    },
    supplier_phone: {
      type: String,
    },
    supplier_address: {
      type: String,
    },
    supplier_status: {
      type: String,
      enum: ["active", "in-active"],
      default: "active",
    },
    supplier_publisher_id: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
    supplier_updated_by: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
  },
  {
    timestamps: true,
  }
);

const SupplierModel = model<ISupplierInterface>("suppliers", supplierSchema);

export default SupplierModel;
