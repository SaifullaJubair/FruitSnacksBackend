import { Schema, model } from "mongoose";
import { IAdminInterface } from "./admin.interface";

// admin Schema
const adminSchema = new Schema<IAdminInterface>(
  {
    admin_password: {
      type: String,
    },
    admin_name: {
      type: String,
    },
    admin_phone: {
      type: String,
    },
    user_logo: {
      type: String,
    },
    user_logo_key: {
      type: String,
    },
    admin_country: {
      type: String,
      default: "Bangladesh",
    },
    admin_district: {
      type: String,
    },
    admin_division: {
      type: String,
    },
    admin_address: {
      type: String,
    },
    admin_status: {
      type: String,
      enum: ["active", "in-active"],
      default: "active",
    },
    role_id: {
      type: Schema.Types.ObjectId,
      ref: "roles",
      required: true,
    },
    admin_publisher_id: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
    admin_updated_by: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
  },
  {
    timestamps: true,
  }
);

const AdminModel = model<IAdminInterface>("admins", adminSchema);

export default AdminModel;
