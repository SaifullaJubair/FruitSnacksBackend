import { Types } from "mongoose";
import { IOrderInterface } from "../order/order.interface";
import { IProductInterface } from "../product/product.interface";
import { IVariationInterface } from "../variation/variation.interface";
import { ICampaignInterface } from "../campaign/campaign.interface";
import { IUserInterface } from "../user/user.interface";

export interface IOrderProductInterface {
  _id?: any;
  order_id: Types.ObjectId | IOrderInterface;
  invoice_id: string;
  product_id: Types.ObjectId | IProductInterface;
  variation_id?: Types.ObjectId | IVariationInterface;
  product_unit_price: number;
  product_unit_final_price: number;
  product_quantity: number;
  product_grand_total_price: number;
  campaign_id?: Types.ObjectId | ICampaignInterface;
  customer_id: Types.ObjectId | IUserInterface;
  product_main_price: number;
  product_main_discount_price: number;

  // Snapshot at order-placement time (Phase 1 SKU/Barcode/QR). Frozen — never
  // updated after creation. Lets historical orders + warehouse pick-lists
  // keep showing the original SKU/barcode even after product rename, SKU
  // edit, or product deletion.
  product_sku_snapshot?: string;
  variation_sku_snapshot?: string;
  product_barcode_snapshot?: string;
  variation_barcode_snapshot?: string;

  // ── Order Unification Phase A (2026-06-11) ─────────────────────────────────
  // [WIRED] Display snapshot — freeze name + image at placement so a historical
  // order keeps showing the right product even after rename / image swap /
  // deletion. Consumers MUST fall back to the live populate when null (legacy
  // orders placed before this field existed): `name_snapshot || product_id.name`.
  product_name_snapshot?: string;
  product_image_snapshot?: string;

  // [WIRED] Which pricing layer produced product_unit_final_price. "campaign"
  // set when campaign_id present; others wired as their flow lands (offer in
  // Phase B). Default "none".
  discount_source?: "offer" | "campaign" | "flash_sale" | "coupon" | "manual" | "none";

  // [WIRED] Per-line VAT — recompute already computes vat_pct per line; persist
  // it so invoices/reports don't have to recompute. vat_amount is the currency
  // value of that line's tax.
  vat_rate?: number;
  vat_amount?: number;

  // ── Per-line customization (slot only — Phase C wires checkout UI + S3) ────
  // For cake text, jewelry engraving, dress size note, book dedication, etc.
  customization_note?: string;
  customization_charge?: number;
  customization_files?: string[]; // S3 URLs of buyer-supplied reference images

  // ── Digital product (slot only — course / ebook; Phase C wires S3 signed URL) ──
  is_digital?: boolean;
  download_url?: string;
  download_expires_at?: string;
  download_count?: number;
}

export const orderProductSearchableField = ["invoice_id"];
