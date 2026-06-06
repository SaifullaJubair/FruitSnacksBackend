import { Schema, model } from "mongoose";
import { ISettingInterface } from "./setting.interface";

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

    pathao_enabled: { type: Boolean, default: false },
    pathao_client_id: { type: String },
    pathao_client_secret: { type: String },
    pathao_username: { type: String },
    pathao_password: { type: String },

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
  },
  { timestamps: true },
);

const SettingModel = model<ISettingInterface>("settings", settingSchema);
export default SettingModel;
