import { Types } from "mongoose";
import { IProductInterface } from "../product/product.interface";
import { IAdminInterface } from "../adminRegLog/admin.interface";

interface ICampaignProducts {
  campaign_product_id: Types.ObjectId | IProductInterface;
  campaign_product_price: number;
  campaign_price_type: "fixed" | "percent";
  campaign_product_status: "active" | "in-active";
}

export interface ICampaignInterface {
  _id?: any;
  campaign_image: string;
  campaign_image_key?: string;
  campaign_title: string;
  campaign_description?: string;
  campaign_start_date: string;
  campaign_end_date: string;
  campaign_status: "active" | "in-active";
  campaign_products?: ICampaignProducts[];
  campaign_publisher_id: Types.ObjectId | IAdminInterface;
  campaign_updated_by?: Types.ObjectId | IAdminInterface;
}

export const campaignSearchableField = [
  "campaign_title",
  "campaign_description",
  "campaign_status",
  "campaign_start_date",
  "campaign_end_date",
];
