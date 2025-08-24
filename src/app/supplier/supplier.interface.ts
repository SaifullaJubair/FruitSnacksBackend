import { Types } from "mongoose";
import { IAdminInterface } from "../adminRegLog/admin.interface";

export interface ISupplierInterface {
  _id?: any;
  supplier_name: string;
  supplier_phone?: string;
  supplier_address?: string;
  supplier_status?: "active" | "in-active";
  supplier_publisher_id?: Types.ObjectId | IAdminInterface;
  supplier_updated_by?: Types.ObjectId | IAdminInterface;
}

export const supplierSearchableField = [
  "supplier_name",
  "supplier_address",
  "supplier_phone",
];
