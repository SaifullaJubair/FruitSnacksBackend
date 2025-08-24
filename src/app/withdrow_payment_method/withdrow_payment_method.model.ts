import { Schema, model } from "mongoose";
import { IPaymentMethodInterface } from "./withdrow_payment_method.interface";

// expence Schema
const paymentMethodSchema = new Schema<IPaymentMethodInterface>(
  {
    minimum_withdrow_amount: {
      required: true,
      type: Number,
    },
    payment_method: {
      required: true,
      type: String,
    },
    payment_method_image: {
      type: String,
    },
    payment_method_image_key: {
      type: String,
    },
    payment_method_status: {
      type: String,
      enum: ["active", "in-active"],
      default: "in-active",
    },
    payment_method_publisher_id: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "admins",
    },
  },
  {
    timestamps: true,
  }
);

const PaymentMethodModel = model<IPaymentMethodInterface>(
  "paymentmethods",
  paymentMethodSchema
);

export default PaymentMethodModel;
