import { Schema, model } from "mongoose";
import { IAbandonedCartInterface } from "./abandonedCart.interface";

const abandonedCartSchema = new Schema<IAbandonedCartInterface>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "users" },
    customer_phone: { type: String, index: true },
    customer_email: { type: String },
    customer_name: { type: String },
    items: [
      {
        _id: false,
        product_id: {
          type: Schema.Types.ObjectId,
          ref: "products",
          required: true,
        },
        variation_id: { type: Schema.Types.ObjectId, ref: "variations" },
        product_name: { type: String },
        unit_price: { type: Number },
        quantity: { type: Number, required: true },
      },
    ],
    cart_total: { type: Number, default: 0 },
    step: {
      type: String,
      enum: ["cart", "shipping", "payment"],
      default: "cart",
    },
    recovered: { type: Boolean, default: false },
    recovered_order_id: { type: Schema.Types.ObjectId, ref: "orders" },
    reminder_sent_at: { type: Date },
    reminder_count: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const AbandonedCartModel = model<IAbandonedCartInterface>(
  "abandoned_carts",
  abandonedCartSchema,
);
export default AbandonedCartModel;
