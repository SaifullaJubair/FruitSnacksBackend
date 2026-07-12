import { Schema, model } from "mongoose";
import { IHomeSectionItem, ISettingInterface } from "./setting.interface";

const settingSchema = new Schema<ISettingInterface>(
  {
    // M28 currency tri-field — see setting.interface.ts for rationale.
    currency_symbol: { type: String },
    currency_code: { type: String },
    currency_name: { type: String },
    inside_dhaka_shipping_charge: { type: Number },
    outside_dhaka_shipping_charge: { type: Number },
    inside_dhaka_shipping_days: { type: Number },
    outside_dhaka_shipping_days: { type: Number },
    logo: { type: String },
    logo_key: { type: String },
    favicon: { type: String },
    favicon_key: { type: String },
    title: { type: String },
    contact: { type: String },
    email: { type: String },
    address: { type: String },
    address_two: { type: String },
    address_three: { type: String },
    welcome_message: { type: String },
    facebook: { type: String },
    instagram: { type: String },
    twitter: { type: String },
    you_tube: { type: String },
    watsapp: { type: String },
    tik_tok: { type: String },
    about_us: { type: String },
    return_policy: { type: String },
    refund_policy: { type: String },
    cancellation_policy: { type: String },
    privacy_policy: { type: String },
    terms_condition: { type: String },
    shipping_info: { type: String },
    card_one_logo: { type: String },
    card_one_title: { type: String },
    card_two_logo: { type: String },
    card_two_title: { type: String },
    card_three_logo: { type: String },
    card_three_title: { type: String },
    card_four_logo: { type: String },
    card_four_title: { type: String },
    seo_title: { type: String },
    seo_description: { type: String },
    seo_keywords: { type: String },

    // ✅ Free Delivery
    free_delivery_enabled: { type: Boolean, default: false },
    free_delivery_type: {
      type: String,
      enum: ["always", "min_order"],
      default: "always",
    },
    free_delivery_min_amount: { type: Number, default: 0 },

    // ✅ Analytics — S4+S5 Phase 1A: IDs + secrets now in DB.
    // Secrets stripped from public /setting via .select(-...) in services.
    meta_pixel_enabled: { type: Boolean, default: false },
    meta_capi_enabled: { type: Boolean, default: false },
    meta_pixel_id: { type: String },
    meta_capi_access_token: { type: String }, // SECRET
    meta_test_event_code: { type: String }, // SECRET

    tiktok_pixel_enabled: { type: Boolean, default: false },
    tiktok_capi_enabled: { type: Boolean, default: false },
    tiktok_pixel_id: { type: String },
    tiktok_capi_access_token: { type: String }, // SECRET
    tiktok_test_event_code: { type: String }, // SECRET

    gtm_enabled: { type: Boolean, default: false },
    gtm_id: { type: String },
    ga4_enabled: { type: Boolean, default: false },
    ga4_id: { type: String },
    clarity_enabled: { type: Boolean, default: false },
    clarity_id: { type: String },
    google_verification_meta: { type: String },

    // ✅ SMS Provider
    sms_provider_name: { type: String },
    sms_api_key: { type: String },
    sms_api_secret: { type: String },
    sms_sender_id: { type: String },
    sms_enabled: { type: Boolean, default: false },

    // ✅ Email Provider
    email_provider_name: { type: String },
    email_host: { type: String },
    email_port: { type: Number },
    email_username: { type: String },
    email_password: { type: String },
    email_from_address: { type: String },
    email_from_name: { type: String },
    email_provider_enabled: { type: Boolean, default: false },

    // ✅ Courier Toggles
    steadfast_enabled: { type: Boolean, default: false },
    steadfast_api_key: { type: String },
    steadfast_api_secret: { type: String },
    // Steadfast does not sign its webhooks, so the guard is a shared token the
    // owner appends to the webhook URL registered in the Steadfast dashboard
    // (?token=…). Generated from the admin Courier tab.
    steadfast_webhook_secret: { type: String },

    pathao_enabled: { type: Boolean, default: false },
    pathao_client_id: { type: String },
    pathao_client_secret: { type: String },
    pathao_username: { type: String },
    pathao_password: { type: String },
    // Required by the send-order payload; was env-only (PATHAO_STORE_ID).
    pathao_store_id: { type: String },
    // Pathao signs its webhooks with HMAC-SHA256 over the raw body. The merchant
    // sets this secret in the Pathao merchant panel; we verify against it.
    pathao_webhook_secret: { type: String },
    // Pathao has separate sandbox and live hosts. Getting this wrong sends REAL
    // orders to the test server, silently — so it is an explicit toggle rather
    // than a free-text URL.
    pathao_sandbox: { type: Boolean, default: false },

    // NOTE: redx_* has no service behind it — there is no RedX integration in
    // this codebase. Left in the schema (harmless) but not exposed in the admin.
    redx_enabled: { type: Boolean, default: false },
    redx_api_key: { type: String },

    // ✅ Announcement Bar (3-item rolling banner at top of page)
    announcement_bar: [
      {
        _id: false,
        text: { type: String, required: true },
        icon: { type: String }, // legacy emoji/text (kept for back-compat)
        icon_key: { type: String }, // curated icon (e.g. "lu:Truck")
        icon_url: { type: String }, // custom uploaded SVG/PNG
      },
    ],

    // ✅ Special offer banner (themed PDP "আজকের বিশেষ অফার" with live countdown)
    offer_enabled: { type: Boolean, default: false },
    offer_text: { type: String },
    offer_end_at: { type: Date },

    // ✅ Payment methods (Phase C)
    cod_enabled: { type: Boolean, default: true },

    manual_mfs_enabled: { type: Boolean, default: false },
    manual_mfs_instruction: { type: String },
    manual_mfs_methods: [
      {
        _id: false,
        name: { type: String, required: true },
        number: { type: String, required: true },
        account_type: {
          type: String,
          enum: ["personal", "agent", "merchant"],
          default: "personal",
        },
        instruction: { type: String },
      },
    ],

    bank_transfer_enabled: { type: Boolean, default: false },
    bank_transfer_instruction: { type: String },
    bank_accounts: [
      {
        _id: false,
        bank_name: { type: String, required: true },
        branch: { type: String },
        account_name: { type: String, required: true },
        account_number: { type: String, required: true },
        routing: { type: String },
      },
    ],

    // SSLCommerz (Phase C1 shipped; secrets live in .env now).
    sslcommerz_enabled: { type: Boolean, default: false },
    sslcommerz_store_id: { type: String }, // deprecated
    sslcommerz_store_password: { type: String }, // deprecated
    sslcommerz_sandbox: { type: Boolean, default: true },

    // C3 — advance / partial payment.
    advance_payment_enabled: { type: Boolean, default: false },
    advance_payment_min_percent: { type: Number, default: 20 },
    advance_payment_methods: [{ type: String }],

    // Phase H — site-wide VAT percent. Default 0 = no tax.
    vat_percentage: { type: Number, default: 0 },

    // Phase G3 — loyalty points config.
    loyalty_enabled: { type: Boolean, default: false },
    loyalty_earn_rate: { type: Number, default: 0 },
    loyalty_redeem_rate: { type: Number, default: 0 },
    loyalty_max_redeem_percent: { type: Number, default: 50 },

    // SKU / Barcode / QR (Phase 1) — owner-tunable per-shop. SKU pattern:
    // <PREFIX>-<CORE_NOUN>-<AXIS1..3>-<HASH>; strip_words drives which words
    // are dropped from product_name when extracting the core noun.
    sku_prefix: { type: String, default: "FS" },
    barcode_auto_generate: { type: Boolean, default: true },
    barcode_default_format: {
      type: String,
      enum: ["CODE128", "EAN13", "UPC", "ITF14"],
      default: "CODE128",
    },
    // QR payload root — defaults to env.FRONTEND_PUBLIC_URL when blank. Allows
    // per-deploy override (e.g. staging vs production storefront hostname)
    // without redeploying the backend.
    qr_storefront_base_url: { type: String },

    // C12 — storefront base URL for SMS body links + share copy. Empty
    // falls back to env.SITE_URL, then a final hardcoded default. Same
    // override pattern as qr_storefront_base_url above.
    storefront_base_url: { type: String },

    // C13 — Storefront behaviour toggles (Tier A + Tier B).
    // Defaults mirror existing behaviour so no admin action needed on upgrade.

    // Tier A — Storefront essentials
    maintain_stock: { type: Boolean, default: true },
    show_sold_count: { type: Boolean, default: true },
    show_view_count: { type: Boolean, default: true },
    show_email_field_checkout: { type: Boolean, default: true },
    enable_promo_at_checkout: { type: Boolean, default: true },
    verify_phone_on_order: { type: Boolean, default: false }, // OFF = anon checkout preserved
    allow_image_download: { type: Boolean, default: false },
    min_order_amount: { type: Number, default: 0 },

    // Tier B — High-value additions
    show_stock_count_on_pdp: { type: Boolean, default: false },
    hide_out_of_stock_products: { type: Boolean, default: false },
    enable_whatsapp_chat: { type: Boolean, default: false },
    whatsapp_number: { type: String, default: "" },
    enable_reviews: { type: Boolean, default: true },
    auto_approve_reviews: { type: Boolean, default: false },

    // Sprint 3 — Seed Review visibility on storefront
    enable_seeded_reviews: { type: Boolean, default: true },

    // ─── Track D — Home Layout Builder ──────────────────────────────────────

    // Typed subdoc array (not Mixed) — Mongoose tracks changes automatically.
    // Default is injected at read-time in getSettingServices (BE backfill).
    home_section_array: {
      type: [
        {
          _id: false,
          id: { type: String, required: true },
          enabled: { type: Boolean, default: true },
          order: { type: Number, required: true },
        },
      ],
      default: undefined,
    },

    // 0. Topbar
    topbar_show: { type: Boolean, default: true },
    topbar_announcement_text: { type: String, default: "" },
    topbar_show_track_order: { type: Boolean, default: true },
    topbar_show_hotline: { type: Boolean, default: true },

    // 1. Navbar
    nav_category_mode: {
      type: String,
      enum: ["simple", "mega", "hamburger", "auto"],
      default: "auto",
    },
    nav_show_search_sticky: { type: Boolean, default: true },
    nav_show_wishlist_icon: { type: Boolean, default: true },
    nav_show_compare_icon: { type: Boolean, default: false },
    nav_extra_links_json: { type: String, default: "[]" },

    // 2. Hero
    hero_show: { type: Boolean, default: true },
    hero_variant: {
      type: String,
      enum: ["single", "carousel", "split"],
      default: "carousel",
    },
    hero_autoplay_seconds: { type: Number, default: 5 },
    hero_show_arrows: { type: Boolean, default: true },

    // 3. Trust strip
    trust_strip_source: {
      type: String,
      enum: ["trust_point", "static_4"],
      default: "trust_point",
    },

    // 4. Featured Categories
    feature_categories_limit: { type: Number, default: 6 },
    feature_categories_title: { type: String, default: "ফিচারড ক্যাটাগরি" },

    // 5. Product strips (7 × 2 fields)
    flash_sale_limit: { type: Number, default: 8 },
    flash_sale_title: { type: String, default: "ফ্ল্যাশ সেল" },
    trending_products_limit: { type: Number, default: 8 },
    trending_products_title: { type: String, default: "ট্রেন্ডিং পণ্য" },
    bestsellers_limit: { type: Number, default: 8 },
    bestsellers_title: { type: String, default: "বেস্টসেলার" },
    new_arrivals_limit: { type: Number, default: 8 },
    new_arrivals_title: { type: String, default: "নতুন পণ্য" },
    just_for_you_limit: { type: Number, default: 8 },
    just_for_you_title: { type: String, default: "শুধু আপনার জন্য" },
    ecommerce_choice_limit: { type: Number, default: 8 },
    ecommerce_choice_title: { type: String, default: "আমাদের পছন্দ" },
    category_wise_strip_limit: { type: Number, default: 4 },
    category_wise_strip_title: { type: String, default: "ক্যাটাগরি ওয়াইজ" },
    category_wise_strip_category_id: { type: String },

    // 6. Offer block
    offers_block_limit: { type: Number, default: 3 },
    offers_block_title: { type: String, default: "স্পেশাল অফার" },
    offers_block_layout: {
      type: String,
      enum: ["grid", "carousel"],
      default: "grid",
    },

    // 7. Promo banner
    promo_banner_image: { type: String },
    promo_banner_image_key: { type: String },
    promo_banner_url: { type: String },
    promo_banner_text_overlay: { type: String, default: "" },

    // 8a. Brand story
    brand_story_title: { type: String, default: "আমাদের গল্প" },
    brand_story_text: { type: String, default: "" },
    brand_story_image: { type: String },
    brand_story_image_key: { type: String },
    brand_story_cta_label: { type: String, default: "আরও জানুন" },
    // The About page is at /about-us. This default was "/about", which is not a
    // route — it seeded the live settings, so the homepage Brand Story button
    // 404'd until the shop owner noticed and retyped the URL.
    brand_story_cta_url: { type: String, default: "/about-us" },

    // 8b. Reviews carousel
    reviews_carousel_source: {
      type: String,
      enum: ["auto_featured", "manual_pick"],
      default: "auto_featured",
    },
    reviews_carousel_ids: { type: String, default: "[]" },
    reviews_carousel_limit: { type: Number, default: 5 },
    reviews_carousel_title: { type: String, default: "কাস্টমারের ভালোবাসা" },

    // 8c. Site FAQ
    site_faq_title: { type: String, default: "সাধারণ প্রশ্ন" },

    // 8d. Newsletter
    newsletter_title: { type: String, default: "অফার পেতে সাইন আপ করুন" },
    newsletter_collect: {
      type: String,
      enum: ["email", "phone", "both"],
      default: "both",
    },

    // 9. Footer
    footer_show_payment_strip: { type: Boolean, default: true },
    footer_payment_methods: { type: String, default: "[]" },
    footer_show_delivery_strip: { type: Boolean, default: true },
    footer_delivery_partners: { type: String, default: "[]" },
    footer_show_mini_newsletter: { type: Boolean, default: true },

    // 10. Chat widgets
    chat_messenger_show: { type: Boolean, default: false },
    chat_messenger_page_id: { type: String, default: "" },
    chat_livechat_show: { type: Boolean, default: false },
    // stored via /setting/secrets — treat as sensitive (arbitrary JS embed)
    chat_livechat_embed_code: { type: String, default: "" },
    chat_widgets_position: {
      type: String,
      enum: ["bottom-right", "bottom-left"],
      default: "bottom-right",
    },
  },
  { timestamps: true },
);

const SettingModel = model<ISettingInterface>("settings", settingSchema);
export default SettingModel;
