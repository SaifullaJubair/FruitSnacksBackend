import { Schema, model } from "mongoose";
import { ISettingInterface } from "./setting.interface";

// setting Schema
const settingSchema = new Schema<ISettingInterface>(
  {
    currency_symbol: {
      type: String,
    },
    currency_code: {
      type: String,
    },
    inside_dhaka_shipping_charge: {
      type: Number,
    },
    outside_dhaka_shipping_charge: {
      type: Number,
    },
    inside_dhaka_shipping_days: {
      type: Number,
    },
    outside_dhaka_shipping_days: {
      type: Number,
    },
    logo: {
      type: String,
    },
    favicon: {
      type: String,
    },
    title: {
      type: String,
    },
    contact: {
      type: String,
    },
    email: {
      type: String,
    },
    tik_tok: {
      type: String,
    },
    address: {
      type: String,
    },
    welcome_message: {
      type: String,
    },
    facebook: {
      type: String,
    },
    instagram: {
      type: String,
    },
    twitter: {
      type: String,
    },
    you_tube: {
      type: String,
    },
    watsapp: {
      type: String,
    },
    about_us: {
      type: String,
    },
    return_policy: {
      type: String,
    },
    refund_policy: {
      type: String,
    },
    cancellation_policy: {
      type: String,
    },
    privacy_policy: {
      type: String,
    },
    terms_condition: {
      type: String,
    },
    shipping_info: {
      type: String,
    },
    card_one_logo: {
      type: String,
    },
    card_one_title: {
      type: String,
    },
    card_two_logo: {
      type: String,
    },
    card_two_title: {
      type: String,
    },
    card_three_logo: {
      type: String,
    },
    card_three_title: {
      type: String,
    },
    card_four_logo: {
      type: String,
    },
    card_four_title: {
      type: String,
    },
    address_two: {
      type: String,
    },
    address_three: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const SettingModel = model<ISettingInterface>("settings", settingSchema);

export default SettingModel;
