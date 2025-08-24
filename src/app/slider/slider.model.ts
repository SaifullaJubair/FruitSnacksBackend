import { Schema, model } from "mongoose";
import { ISliderInterface } from "./slider.interface";

// slider Schema
const sliderSchema = new Schema<ISliderInterface>(
  {
    slider_image: {
      required: true,
      type: String,
    },
    slider_image_key: {
      required: true,
      type: String,
    },
    slider_path: {
      type: String,
    },
    slider_serial: {
      required: true,
      type: Number,
    },
    slider_status: {
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

const SliderModel = model<ISliderInterface>("sliders", sliderSchema);

export default SliderModel;
