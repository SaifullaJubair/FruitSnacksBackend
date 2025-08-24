import { Schema, model } from "mongoose";
import { IOrderProductInterface } from "./orderProduct.interface";

// orderProduct Schema
const orderProductSchema = new Schema<IOrderProductInterface>(
  {
    invoice_id: {
      required: true,
      type: String,
    },
    order_id: {
      type: Schema.Types.ObjectId,
      ref: "orders",
      required: true,
    },
    product_id: {
      type: Schema.Types.ObjectId,
      ref: "products",
      required: true,
    },
    variation_id: {
      type: Schema.Types.ObjectId,
      ref: "variations",
    },
    product_main_price: {
      type: Number,
      required: true,
    },
    product_main_discount_price: {
      type: Number,
      required: true,
      default: 0,
    },
    product_unit_price: {
      type: Number,
      required: true,
    },
    product_quantity: {
      type: Number,
      required: true,
    },
    product_unit_final_price: {
      type: Number,
      required: true,
    },
    product_grand_total_price: {
      type: Number,
      required: true,
    },
    campaign_id: {
      type: Schema.Types.ObjectId,
      ref: "campaigns",
    },
    customer_id: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const OrderProductModel = model<IOrderProductInterface>(
  "orderproducts",
  orderProductSchema
);

export default OrderProductModel;
