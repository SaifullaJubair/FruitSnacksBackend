/**
 * warehouse.interface.ts — Phase H.
 *
 * Field-level stub for multi-warehouse stock. A single default warehouse is
 * fine for V1; product/variation `warehouse_id` is optional and null = "the
 * system default warehouse". Adding the field now means the multi-warehouse
 * upgrade later is a logic change only — no schema migration on existing rows.
 */

import { Types } from "mongoose";

export interface IWarehouseInterface {
  _id?: any;
  name: string;
  code?: string; // short ref, e.g. "DHK-01"
  address?: string;
  city?: string;
  is_default?: boolean;
  status?: "active" | "in-active";
  publisher_id?: Types.ObjectId;
  updated_by?: Types.ObjectId;
}

export const warehouseSearchableField = ["name", "code", "city", "status"];
