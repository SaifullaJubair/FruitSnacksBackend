import { Schema, model } from "mongoose";
import { IOfferInterface } from "./offer.interface";

// Offer Schema
const offerSchema = new Schema<IOfferInterface>(
  {
    offer_image: {
      required: true,
      type: String,
    },
    offer_image_key: {
      type: String,
    },
    offer_start_date: {
      required: true,
      type: String,
    },
    offer_end_date: {
      required: true,
      type: String,
    },
    offer_title: {
      required: true,
      type: String,
    },
    offer_description: {
      type: String,
    },
    offer_status: {
      type: String,
      enum: ["active", "in-active"],
      default: "in-active",
    },
    offer_products: [
      {
        offer_product_id: {
          type: Schema.Types.ObjectId,
          ref: "products",
        },
        offer_product_quantity: {
          type: Number,
          required: true,
        },
        offer_discount_price: {
          type: Number,
          required: true,
        },
        offer_discount_type: {
          type: String,
          enum: ["fixed", "percent"],
          required: true,
        },
      },
    ],
    offer_publisher_id: {
      type: Schema.Types.ObjectId,
      ref: "admins",
      required: true,
    },
    offer_updated_by: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
  },
  {
    timestamps: true,
  }
);

const OfferModel = model<IOfferInterface>("offers", offerSchema);

export default OfferModel;
