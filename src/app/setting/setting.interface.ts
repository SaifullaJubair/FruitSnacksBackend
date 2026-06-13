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

  // C12 (Sprint 2): storefront base URL used in SMS body links + share copy.
  // DB-first / .env-fallback / hardcoded last-ditch — buyer can change
  // domain from Admin without a redeploy. Mirrors qr_storefront_base_url.
  storefront_base_url?: string;

  // C13 (Sprint 2): Storefront behaviour toggles (Tier A + Tier B).
  // Defaults preserve existing behaviour so fresh-clone + existing shops
  // are unaffected without any admin action.

  // Tier A — Storefront essentials (7 fields)
  maintain_stock?: boolean;          // false → skip guard AND decrement (pre-order/MTO mode)
  show_sold_count?: boolean;         // false → hide "X জন কিনেছে" badge on PDP
  show_view_count?: boolean;         // false → hide "X জন দেখেছেন" view-count badge on PDP
  show_email_field_checkout?: boolean; // false → remove email input from checkout
  enable_promo_at_checkout?: boolean;  // false → remove coupon input from checkout
  verify_phone_on_order?: boolean;   // true → OTP step before order submit (default OFF = anon checkout preserved)
  allow_image_download?: boolean;    // false → onContextMenu preventDefault on images
  min_order_amount?: number;         // > 0 → reject orders below this amount (server-enforced)

  // Tier B — High-value additions (6 fields, 5 toggles + 1 string)
  show_stock_count_on_pdp?: boolean; // true → "শুধু ৩টা বাকি" urgency badge on PDP
  hide_out_of_stock_products?: boolean; // true → exclude OOS from listings (server-side)
  enable_whatsapp_chat?: boolean;    // true → show floating WhatsApp icon on storefront
  whatsapp_number?: string;          // the merchant WhatsApp number (paired with toggle above)
  enable_reviews?: boolean;          // false → hide review section + form on PDP
  auto_approve_reviews?: boolean;    // true → review goes live immediately; false → pending queue

  // Sprint 3 — Seed Review toggle
  // false → strip is_seeded reviews from storefront GET /review/:id (real reviews only)
  // true  → show all reviews including seeded ones (default: show them for fresh shops)
  enable_seeded_reviews?: boolean;

  // ─── Track D — Home Layout Builder ────────────────────────────────────────

  // Section order + enabled state. Typed subdoc array (NOT Mixed) so Mongoose
  // change-detection works without .markModified(). Backfilled to L9 DTC
  // defaults on first GET if missing. `enabled` here is the canonical source
  // of truth — flat `_show` fields were dropped to avoid dual-source conflict.
  home_section_array?: IHomeSectionItem[];

  // 0. Topbar
  topbar_show?: boolean;
  topbar_announcement_text?: string;
  topbar_show_track_order?: boolean;
  topbar_show_hotline?: boolean;

  // 1. Navbar
  nav_category_mode?: "simple" | "mega" | "hamburger" | "auto";
  nav_show_search_sticky?: boolean;
  nav_show_wishlist_icon?: boolean;
  nav_show_compare_icon?: boolean;
  nav_extra_links_json?: string; // JSON string, max 4 links [{label,url}]

  // 2. Hero
  hero_show?: boolean;
  hero_variant?: "single" | "carousel" | "split";
  hero_autoplay_seconds?: number; // 0 = disabled
  hero_show_arrows?: boolean;

  // 3. Trust strip
  trust_strip_source?: "trust_point" | "static_4";

  // 4. Featured Categories
  feature_categories_limit?: number;
  feature_categories_title?: string;

  // 5. Product strip config (7 strips × 2 = 14 fields — _show dropped, enabled comes from home_section_array)
  flash_sale_limit?: number;
  flash_sale_title?: string;
  trending_products_limit?: number;
  trending_products_title?: string;
  bestsellers_limit?: number;
  bestsellers_title?: string;
  new_arrivals_limit?: number;
  new_arrivals_title?: string;
  just_for_you_limit?: number;
  just_for_you_title?: string;
  ecommerce_choice_limit?: number;
  ecommerce_choice_title?: string;
  category_wise_strip_limit?: number;
  category_wise_strip_title?: string;
  category_wise_strip_category_id?: string; // ObjectId ref to category

  // 6. Offer block
  offers_block_limit?: number;
  offers_block_title?: string;
  offers_block_layout?: "grid" | "carousel";

  // 7. Promo banner
  promo_banner_image?: string;
  promo_banner_image_key?: string; // S3 key for cleanup on replace
  promo_banner_url?: string;
  promo_banner_text_overlay?: string;

  // 8a. Brand story
  brand_story_title?: string;
  brand_story_text?: string;
  brand_story_image?: string;
  brand_story_image_key?: string; // S3 key for cleanup on replace
  brand_story_cta_label?: string;
  brand_story_cta_url?: string;

  // 8b. Reviews carousel
  reviews_carousel_source?: "auto_featured" | "manual_pick";
  reviews_carousel_ids?: string; // JSON string — array of review _id strings
  reviews_carousel_limit?: number;
  reviews_carousel_title?: string;

  // 8c. Site FAQ (content lives in siteFaq collection)
  site_faq_title?: string;

  // 8d. Newsletter
  newsletter_title?: string;
  newsletter_collect?: "email" | "phone" | "both";

  // 9. Footer
  footer_show_payment_strip?: boolean;
  footer_payment_methods?: string; // JSON string, preset icon keys
  footer_show_delivery_strip?: boolean;
  footer_delivery_partners?: string; // JSON string, preset icon keys
  footer_show_mini_newsletter?: boolean;

  // 10. Chat widgets
  // chat_whatsapp_show reuses existing enable_whatsapp_chat (C13)
  chat_messenger_show?: boolean;
  chat_messenger_page_id?: string;
  chat_livechat_show?: boolean;
  // stored via /setting/secrets — arbitrary embed JS treated as sensitive
  chat_livechat_embed_code?: string;
  chat_widgets_position?: "bottom-right" | "bottom-left";
}

export interface IHomeSectionItem {
  id: string;
  enabled: boolean;
  order: number;
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
