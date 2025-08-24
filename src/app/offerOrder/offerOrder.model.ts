import { Schema, model } from "mongoose";
import { IOfferOrderInterface } from "./offerOrder.interface";

// OfferOrder Schema
const offerOrderSchema = new Schema<IOfferOrderInterface>(
  {
    invoice_id: {
      required: true,
      type: String,
    },
    order_status: {
      required: true,
      type: String,
      enum: [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancel",
        "return",
      ],
      default: "pending",
    },
    pending_time: {
      type: String,
    },
    processing_time: {
      type: String,
    },
    shipped_time: {
      type: String,
    },
    delivered_time: {
      type: String,
    },
    cancel_time: {
      type: String,
    },
    return_time: {
      type: String,
    },
    billing_country: {
      required: true,
      type: String,
    },
    billing_city: {
      required: true,
      type: String,
    },
    billing_state: {
      required: true,
      type: String,
    },
    billing_address: {
      required: true,
      type: String,
    },
    product_total_amount: {
      required: true,
      type: Number,
    },
    discount_amount: {
      required: true,
      type: Number,
    },
    sub_total_amount: {
      required: true,
      type: Number,
    },
    shipping_cost: {
      required: true,
      type: Number,
    },
    shipping_location: {
      required: true,
      type: String,
    },
    grand_total_amount: {
      required: true,
      type: Number,
    },
    customer_id: {
      required: true,
      type: Schema.Types.ObjectId,
      ref: "users",
    },
    customer_phone: {
      required: true,
      type: String,
    },
    order_updated_by: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
    offer_id: {
      required: true,
      type: Schema.Types.ObjectId,
      ref: "offers",
    },
    offer_products: [
      {
        offer_product_id: {
          required: true,
          type: Schema.Types.ObjectId,
          ref: "products",
        },
        offer_product_main_price: {
          required: true,
          type: Number,
        },
        offer_product_main_discount_price: {
          required: true,
          type: Number,
          default: 0,
        },
        offer_product_price: {
          required: true,
          type: Number,
        },
        offer_product_quantity: {
          required: true,
          type: Number,
        },
        offer_discount_price: {
          required: true,
          type: Number,
        },
        offer_discount_type: {
          required: true,
          type: String,
          enum: ["fixed", "percent"],
        },
        is_variation: {
          required: true,
          type: Boolean,
        },
        variation_id: {
          type: Schema.Types.ObjectId,
          ref: "variations",
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const OfferOrderModel = model<IOfferOrderInterface>(
  "offerorders",
  offerOrderSchema
);

export default OfferOrderModel;
