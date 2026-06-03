import { Schema, model } from "mongoose";
import { ITrustPointInterface } from "./trustPoint.interface";

const TrustPointItemSchema = new Schema(
  {
    icon_key: { type: String },
    icon_url: { type: String },
    title: { type: String },
    subtitle: { type: String },
  },
  { _id: false },
);

const TrustPointSchema = new Schema<ITrustPointInterface>(
  {
    points: { type: [TrustPointItemSchema], default: [] },
    _updated_by: { type: Schema.Types.ObjectId, ref: "admins" },
  },
  { timestamps: true },
);

const TrustPointModel = model<ITrustPointInterface>(
  "trust_points",
  TrustPointSchema,
);

export default TrustPointModel;
