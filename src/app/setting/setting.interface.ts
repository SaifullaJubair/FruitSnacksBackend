export interface ISettingInterface {
  _id?: any;
  // Currency tri-field (M28). Symbol for prefix display ("৳500"), code for
  // payment-gateway calls + ISO data ("BDT"), name for spelled-out display
  // ("500 টাকা"). Defaults are Bangladesh; any clone overrides via Admin.
  currency_symbol?: string;
  currency_code?: string;
  currency_name?: string;
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

  // ✅ Analytics Pixels — S4+S5 Phase 1A (2026-06-05).
  // 3-tier model:
  //   Tier 1 (PUBLIC ID): visible in /setting GET — browser already shows
  //   these in pixel scripts, no extra leak vs current architecture.
  //   Tier 2 (SECRET): stripped from public /setting via .select(-...) and
  //   only readable via /setting/secrets (admin-only, setting_secrets_update
  //   permission flag required). Never reach the browser.
  meta_pixel_enabled?: boolean;
  meta_capi_enabled?: boolean;
  meta_pixel_id?: string; // Tier 1 public
  meta_capi_access_token?: string; // Tier 2 secret
  meta_test_event_code?: string; // Tier 2 secret (debug-only test events)

  tiktok_pixel_enabled?: boolean;
  tiktok_capi_enabled?: boolean;
  tiktok_pixel_id?: string; // Tier 1 public
  tiktok_capi_access_token?: string; // Tier 2 secret
  tiktok_test_event_code?: string; // Tier 2 secret

  gtm_enabled?: boolean;
  gtm_id?: string; // Tier 1 public
  ga4_enabled?: boolean;
  ga4_id?: string; // Tier 1 public
  clarity_enabled?: boolean;
  clarity_id?: string; // Tier 1 public
  google_verification_meta?: string; // Tier 1 public (Search Console verify)

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

  // C4 — manual bank transfer + screenshot upload (shipped Phase C4).
  bank_transfer_enabled?: boolean;
  bank_accounts?: IBankAccount[];
  bank_transfer_instruction?: string;

  // C1 — SSLCommerz integration (cards + bKash + Nagad + Rocket). Secrets are
  // read from .env (SSLCOMMERZ_STORE_ID + SSLCOMMERZ_STORE_PASSWORD); these
  // settings fields toggle on/off + sandbox-vs-live from the admin UI.
  sslcommerz_enabled?: boolean;
  /** @deprecated read from .env at runtime; kept for back-compat. */
  sslcommerz_store_id?: string;
  /** @deprecated read from .env at runtime; kept for back-compat. */
  sslcommerz_store_password?: string;
  sslcommerz_sandbox?: boolean;

  // C3 — advance / partial payment. Customer pays X% online to confirm the
  // order; the rest is collected COD on delivery. Order doc gets
  // `payment_method:"cod"` + `advance_amount=X`; the chosen advance method
  // (e.g. sslcommerz) is initiated separately for just the advance.
  advance_payment_enabled?: boolean;
  advance_payment_min_percent?: number; // e.g. 20 → must pre-pay ≥20%
  advance_payment_methods?: Array<
    "sslcommerz" | "manual_mfs" | "bank_transfer"
  >;

  // Phase H — site-wide VAT/tax percent applied at checkout. Default 0
  // (no tax). Per-product `vat_percentage_override` beats this when set > 0.
  vat_percentage?: number;

  // Phase G3 — loyalty points configuration.
  loyalty_enabled?: boolean;
  // Earn: how many points the buyer gets per 1 unit of currency spent.
  // e.g. earn_rate = 1 → 100tk order = 100 points.
  loyalty_earn_rate?: number;
  // Redeem: how many currency units 1 point is worth at checkout.
  // e.g. redeem_rate = 0.01 → 100 points = 1tk discount.
  loyalty_redeem_rate?: number;
  // Optional cap so a single order can't be 100% paid with points.
  loyalty_max_redeem_percent?: number;

  // SKU / Barcode / QR (Phase 1) — owner-tunable per-shop.
  sku_prefix?: string;
  barcode_auto_generate?: boolean;
  barcode_default_format?: "CODE128" | "EAN13" | "UPC" | "ITF14";
  qr_storefront_base_url?: string;
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
