import { Schema, model } from "mongoose";
import { IBannerInterface } from "./banner.interface";

// Banner Schema
const bannerSchema = new Schema<IBannerInterface>(
  {
    banner_title: {
      required: true,
      type: String,
    },
    banner_image: {
      required: true,
      type: String,
    },
    banner_image_key: {
      required: true,
      type: String,
    },
    banner_path: {
      type: String,
    },
    banner_serial: {
      required: true,
      type: Number,
    },
    banner_status: {
      required: true,
      type: String,
      enum: ["active", "in-active"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

const BannerModel = model<IBannerInterface>("banners", bannerSchema);

export default BannerModel;
