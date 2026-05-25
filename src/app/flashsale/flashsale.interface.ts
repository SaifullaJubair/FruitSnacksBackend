/**
 * flashsale.interface.ts — Phase E.
 *
 * A flash sale is a time-boxed price drop on a set of products. While active
 * (now between start/end + status=active), `resolveProductPrice` consults the
 * flash sale first — so the storefront countdown + price all read from one
 * authoritative source. Mutually-exclusive with `campaign` (higher priority).
 */

import { Types } from "mongoose";

export interface IFlashSaleProduct {
  product_id: Types.ObjectId;
  /** Either an absolute price (`fixed`) or a percent off (`percent`). */
  flash_price: number;
  flash_price_type: "fixed" | "percent";
  active?: boolean;
}

export interface IFlashSaleInterface {
  _id?: any;
  title: string;
  description?: string;
  start_at: Date | string;
  end_at: Date | string;
  status: "active" | "in-active";
  products: IFlashSaleProduct[];
  flash_sale_publisher_id?: Types.ObjectId;
  flash_sale_updated_by?: Types.ObjectId;
}

export const flashSaleSearchableField = ["title", "description", "status"];
