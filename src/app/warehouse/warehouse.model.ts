import { Schema, model } from "mongoose";
import { IWarehouseInterface } from "./warehouse.interface";

const warehouseSchema = new Schema<IWarehouseInterface>(
  {
    name: { type: String, required: true },
    code: { type: String },
    address: { type: String },
    city: { type: String },
    is_default: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["active", "in-active"],
      default: "active",
    },
    publisher_id: { type: Schema.Types.ObjectId, ref: "admins" },
    updated_by: { type: Schema.Types.ObjectId, ref: "admins" },
  },
  { timestamps: true },
);

const WarehouseModel = model<IWarehouseInterface>(
  "warehouses",
  warehouseSchema,
);
export default WarehouseModel;
