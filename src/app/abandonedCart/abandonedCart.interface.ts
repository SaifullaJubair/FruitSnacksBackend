/**
 * abandonedCart.interface.ts — Phase G2.
 *
 * A row is created (or upserted) when a user reaches checkout-intent but
 * doesn't complete an order. Captures contact + cart snapshot so an offline
 * job (or admin UI later) can send a recovery email/SMS. `recovered` flips
 * true (and `recovered_order_id` is linked) when an order is later placed with
 * the same `customer_phone` — recovery is matched by PHONE, not invoice_id.
 */

import { Types } from "mongoose";

export interface IAbandonedCartItem {
  product_id: Types.ObjectId;
  variation_id?: Types.ObjectId;
  product_name?: string;
  unit_price?: number;
  quantity: number;
}

export interface IAbandonedCartInterface {
  _id?: any;
  user_id?: Types.ObjectId; // null if guest
  customer_phone?: string;
  customer_email?: string;
  customer_name?: string;
  items: IAbandonedCartItem[];
  cart_total?: number;
  step?: "cart" | "shipping" | "payment"; // how far they got
  recovered?: boolean;
  recovered_order_id?: Types.ObjectId;
  reminder_sent_at?: Date;
  reminder_count?: number;
}
