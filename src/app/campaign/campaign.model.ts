import { Schema, model } from "mongoose";
import { ICampaignInterface } from "./campaign.interface";

// Campaign Schema
const campaignSchema = new Schema<ICampaignInterface>(
  {
    campaign_image: {
      required: true,
      type: String,
    },
    campaign_image_key: {
      type: String,
    },
    campaign_title: {
      required: true,
      type: String,
    },
    campaign_description: {
      type: String,
    },
    campaign_start_date: {
      required: true,
      type: String,
    },
    campaign_end_date: {
      required: true,
      type: String,
    },
    campaign_status: {
      type: String,
      required: true,
      enum: ["active", "in-active"],
      default: "in-active",
    },
    campaign_publisher_id: {
      type: Schema.Types.ObjectId,
      ref: "admins",
      required: true,
    },
    campaign_products: [
      {
        campaign_product_id: {
          type: Schema.Types.ObjectId,
          ref: "products",
          required: true,
        },
        campaign_product_price: {
          type: Number,
          required: true,
        },
        campaign_product_status: {
          type: String,
          enum: ["active", "in-active"],
          default: "active",
        },
        campaign_price_type: {
          type: String,
          enum: ["fixed", "percent"],
          default: "fixed",
        },
      },
    ],
    campaign_updated_by: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
  },
  {
    timestamps: true,
  }
);

const CampaignModel = model<ICampaignInterface>("campaigns", campaignSchema);

export default CampaignModel;
