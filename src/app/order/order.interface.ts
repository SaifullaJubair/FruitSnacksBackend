import { Types } from "mongoose";
import { IAdminInterface } from "../adminRegLog/admin.interface";
import { ICouponInterface } from "../coupon/coupon.interface";

export interface IOrderInterface {
  _id?: any;
  invoice_id: string;
  order_status:
    | "pending"
    | "processing"
    | "shipped"
    | "delivered"
    | "cancel"
    | "return";
  pending_time?: string;
  processing_time?: string;
  shipped_time?: string;
  delivered_time?: string;
  cancel_time?: string;
  return_time?: string;
  billing_country: string;
  billing_city: string;
  billing_state: string;
  billing_address: string;
  shipping_location: string;
  sub_total_amount: number;
  discount_amount: number;
  shipping_cost: number;
  grand_total_amount: number;
  coupon_id?: Types.ObjectId | ICouponInterface;
  customer_id: Types.ObjectId | IAdminInterface;
  customer_phone: string;
  order_updated_by?: Types.ObjectId | IAdminInterface;
  tracking_code?: string;
  pathao_city_id: number;
  pathao_city_name: string;
  pathao_zone_id: number;
  pathao_zone_name: string;
  pathao_status?: string;
  consignment_id?: string;
  delivery_fee?: number;
  courier_type?: "pathao" | "steadfast";
  steadfast_consignment_id?: string;
  steadfast_tracking_code?: string;
  steadfast_status?: string;
  steadfast_tracking_message?: string;
  // ── Delivery override fields (admin editable) ─────────────────────────────
  // Courier এ পাঠানোর সময় এগুলো থাকলে use হবে, না থাকলে original billing data
  delivery_name?: string; // recipient name override
  delivery_phone?: string; // recipient phone override
  delivery_alt_phone?: string; // alternative phone (Steadfast support করে)
  delivery_address?: string; // address override
  delivery_note?: string; // courier note / delivery instruction
  // ── Stock lifecycle (Phase B) ─────────────────────────────────────────────
  // Stock is decremented at PLACEMENT. When an order is cancelled/returned the
  // stock is added back exactly once; this flag guards against double-restock.
  stock_restored?: boolean;
  // ── Payment (Phase C) ─────────────────────────────────────────────────────
  // payment_method: how the buyer will pay. Defaults to "cod" so any caller
  // that omits this field keeps the pre-Phase-C cash-on-delivery flow.
  // payment_status: the lifecycle of the money. "unpaid" = nothing happened
  // yet (the COD default); "pending" = customer has submitted a trxId we
  // haven't verified; "paid" = confirmed; "failed" = gateway/admin declined
  // (triggers restock + order cancel); "partial" = advance paid, rest COD
  // (Phase C3); "refunded" = money returned to buyer after a cancel/return.
  payment_method?:
    | "cod"
    | "manual_mfs"
    | "sslcommerz"
    | "bank_transfer";
  payment_status?:
    | "unpaid"
    | "pending"
    | "paid"
    | "partial"
    | "failed"
    | "refunded";
  transaction_id?: string; // gateway txn id OR customer-submitted mfs trxId
  paid_amount?: number; // total money actually received (cumulative)
  advance_amount?: number; // pre-paid online portion (Phase C3 partial)
  paid_at?: string;
  // Raw gateway/admin payload stash — keeps audit trail without schema bloat.
  payment_meta?: any;

  // Phase H — VAT/tax amount on this order. Computed server-side as the sum
  // of per-line tax (per-product override beats settings.vat_percentage),
  // applied AFTER discount, BEFORE grand_total_amount.
  vat_amount?: number;

  // ── Phase G3 cart-side redeem (F1b) ───────────────────────────────────────
  // Loyalty points the buyer chose to redeem at checkout. Server clamps to
  // (a) the user's balance and (b) `settings.loyalty_max_redeem_percent` × grand_total.
  // The corresponding currency value goes into `discount_amount`. Persisted so
  // post-commit `moveLoyalty(-points, "order_redeem")` is traceable + so the
  // admin can see the redemption on the order detail page.
  loyalty_redeem_points?: number;
  loyalty_redeem_amount?: number;
}

export const orderSearchableField = [
  "invoice_id",
  "order_status",
  "customer_phone",
];
