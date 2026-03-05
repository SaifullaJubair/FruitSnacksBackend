import { Schema, model } from "mongoose";
import { ISettingInterface } from "./setting.interface";

const settingSchema = new Schema<ISettingInterface>(
  {
    currency_symbol: { type: String },
    currency_code: { type: String },
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

    // ✅ Analytics — শুধু enabled toggles, ID/token নেই (সেগুলো .env এ)
    meta_pixel_enabled: { type: Boolean, default: false },
    meta_capi_enabled: { type: Boolean, default: false },

    tiktok_pixel_enabled: { type: Boolean, default: false },
    tiktok_capi_enabled: { type: Boolean, default: false },

    gtm_enabled: { type: Boolean, default: false },
    ga4_enabled: { type: Boolean, default: false },
    clarity_enabled: { type: Boolean, default: false },

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
  },
  { timestamps: true },
);

const SettingModel = model<ISettingInterface>("settings", settingSchema);
export default SettingModel;
