export interface ISettingInterface {
  _id?: any;
  currency_symbol?: string;
  currency_code?: string;
  inside_dhaka_shipping_charge?: number;
  outside_dhaka_shipping_charge?: number;
  inside_dhaka_shipping_days?: number;
  outside_dhaka_shipping_days?: number;
  logo?: string;
  logo_key?: string;
  favicon?: string;
  favicon_key?: string;
  title?: string;
  contact?: string;
  email?: string;
  address?: string;
  address_two?: string;
  address_three?: string;
  welcome_message?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  you_tube?: string;
  watsapp?: string;
  tik_tok?: string;
  about_us?: string;
  return_policy?: string;
  refund_policy?: string;
  cancellation_policy?: string;
  privacy_policy?: string;
  terms_condition?: string;
  shipping_info?: string;
  card_one_logo?: string;
  card_one_title?: string;
  card_two_logo?: string;
  card_two_title?: string;
  card_three_logo?: string;
  card_three_title?: string;
  card_four_logo?: string;
  card_four_title?: string;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;

  // ✅ Free Delivery
  free_delivery_enabled?: boolean;
  free_delivery_type?: "always" | "min_order";
  free_delivery_min_amount?: number;

  // ✅ Analytics Pixels
  meta_pixel_enabled?: boolean;
  meta_capi_enabled?: boolean;

  tiktok_pixel_enabled?: boolean;
  tiktok_capi_enabled?: boolean;
  
  gtm_enabled?: boolean;
  ga4_enabled?: boolean;
  clarity_enabled?: boolean;

  // ✅ SMS Provider
  sms_provider_name?: string;
  sms_api_key?: string;
  sms_api_secret?: string;
  sms_sender_id?: string;
  sms_enabled?: boolean;

  // ✅ Email Provider
  email_provider_name?: string;
  email_host?: string;
  email_port?: number;
  email_username?: string;
  email_password?: string;
  email_from_address?: string;
  email_from_name?: string;
  email_provider_enabled?: boolean;

  // ✅ Courier Toggles
  steadfast_enabled?: boolean;
  steadfast_api_key?: string;
  steadfast_api_secret?: string;

  pathao_enabled?: boolean;
  pathao_client_id?: string;
  pathao_client_secret?: string;
  pathao_username?: string;
  pathao_password?: string;

  redx_enabled?: boolean;
  redx_api_key?: string;

  // ✅ Announcement Bar (top of page, 3 items in design)
  announcement_bar?: IAnnouncementBarItem[];

  // ✅ Special offer banner (themed PDP "আজকের বিশেষ অফার" with live countdown)
  offer_enabled?: boolean;
  offer_text?: string;
  offer_end_at?: Date | string;

  // ✅ Payment methods (Phase C) — per-gateway toggles + config. cod is on
  // by default for legacy compatibility; other methods opt-in via admin.
  cod_enabled?: boolean;

  // C2 — Manual MFS (customer pays to merchant's bkash/nagad number, sends
  // trxId, admin verifies). manual_mfs_methods[] = the displayable list.
  manual_mfs_enabled?: boolean;
  manual_mfs_methods?: IManualMfsMethod[];
  manual_mfs_instruction?: string; // shared note above the methods list

  // C4 (stub fields now) — manual bank transfer + screenshot upload.
  bank_transfer_enabled?: boolean;
  bank_accounts?: IBankAccount[];

  // C1 (stub fields now) — SSLCommerz integration (cards + bKash + Nagad + Rocket).
  sslcommerz_enabled?: boolean;
  sslcommerz_store_id?: string;
  sslcommerz_store_password?: string;
  sslcommerz_sandbox?: boolean;
}

export interface IManualMfsMethod {
  name: string; // "bKash", "Nagad", "Rocket", ...
  number: string; // the merchant's receiving number
  account_type?: "personal" | "agent" | "merchant";
  instruction?: string; // per-method instruction (optional)
}

export interface IBankAccount {
  bank_name: string;
  branch?: string;
  account_name: string;
  account_number: string;
  routing?: string;
}

export interface IAnnouncementBarItem {
  text: string;
  icon?: string; // legacy emoji/text (kept for back-compat)
  icon_key?: string; // curated icon (e.g. "lu:Truck")
  icon_url?: string; // custom uploaded SVG/PNG
}

export interface ITrustPoint {
  logo?: string;
  title?: string;
}
