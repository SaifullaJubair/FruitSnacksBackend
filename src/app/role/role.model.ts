import { Schema, model } from "mongoose";
import { IRoleInterface } from "./role.interface";

// Role Schema
const roleSchema = new Schema<IRoleInterface>(
  {
    role_name: {
      required: true,
      type: String,
    },
    role_publisher_id: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
    role_updated_by: {
      type: Schema.Types.ObjectId,
      ref: "admins",
    },
    category_post: {
      type: Boolean,
      default: false,
    },
    category_delete: {
      type: Boolean,
      default: false,
    },
    category_update: {
      type: Boolean,
      default: false,
    },
    category_show: {
      type: Boolean,
      default: false,
    },
    sub_category_post: {
      type: Boolean,
      default: false,
    },
    sub_category_delete: {
      type: Boolean,
      default: false,
    },
    sub_category_update: {
      type: Boolean,
      default: false,
    },
    sub_category_show: {
      type: Boolean,
      default: false,
    },
    child_category_post: {
      type: Boolean,
      default: false,
    },
    child_category_delete: {
      type: Boolean,
      default: false,
    },
    child_category_update: {
      type: Boolean,
      default: false,
    },
    child_category_show: {
      type: Boolean,
      default: false,
    },
    brand_post: {
      type: Boolean,
      default: false,
    },
    brand_delete: {
      type: Boolean,
      default: false,
    },
    brand_update: {
      type: Boolean,
      default: false,
    },
    brand_show: {
      type: Boolean,
      default: false,
    },
    attribute_delete: {
      type: Boolean,
      default: false,
    },
    attribute_post: {
      type: Boolean,
      default: false,
    },
    attribute_update: {
      type: Boolean,
      default: false,
    },
    attribute_show: {
      type: Boolean,
      default: false,
    },
    specification_post: {
      type: Boolean,
      default: false,
    },
    specification_delete: {
      type: Boolean,
      default: false,
    },
    specification_update: {
      type: Boolean,
      default: false,
    },
    specification_show: {
      type: Boolean,
      default: false,
    },
    product_create: {
      type: Boolean,
      default: false,
    },
    product_delete: {
      type: Boolean,
      default: false,
    },
    product_update: {
      type: Boolean,
      default: false,
    },
    product_show: {
      type: Boolean,
      default: false,
    },
    offer_create: {
      type: Boolean,
      default: false,
    },
    offer_delete: {
      type: Boolean,
      default: false,
    },
    offer_update: {
      type: Boolean,
      default: false,
    },
    offer_show: {
      type: Boolean,
      default: false,
    },
    campaign_create: {
      type: Boolean,
      default: false,
    },
    campaign_delete: {
      type: Boolean,
      default: false,
    },
    campaign_update: {
      type: Boolean,
      default: false,
    },
    campaign_show: {
      type: Boolean,
      default: false,
    },
    user_create: {
      type: Boolean,
      default: false,
    },
    user_delete: {
      type: Boolean,
      default: false,
    },
    user_update: {
      type: Boolean,
      default: false,
    },
    user_show: {
      type: Boolean,
      default: false,
    },
    role_create: {
      type: Boolean,
      default: false,
    },
    role_delete: {
      type: Boolean,
      default: false,
    },
    role_show: {
      type: Boolean,
      default: false,
    },
    role_update: {
      type: Boolean,
      default: false,
    },
    review_update: {
      type: Boolean,
      default: false,
    },
    review_show: {
      type: Boolean,
      default: false,
    },
    question_update: {
      type: Boolean,
      default: false,
    },
    question_show: {
      type: Boolean,
      default: false,
    },
    coupon_create: {
      type: Boolean,
      default: false,
    },
    coupon_delete: {
      type: Boolean,
      default: false,
    },
    coupon_update: {
      type: Boolean,
      default: false,
    },
    coupon_show: {
      type: Boolean,
      default: false,
    },
    banner_create: {
      type: Boolean,
      default: false,
    },
    banner_delete: {
      type: Boolean,
      default: false,
    },
    banner_update: {
      type: Boolean,
      default: false,
    },
    banner_show: {
      type: Boolean,
      default: false,
    },
    slider_create: {
      type: Boolean,
      default: false,
    },
    slider_delete: {
      type: Boolean,
      default: false,
    },
    slider_update: {
      type: Boolean,
      default: false,
    },
    slider_show: {
      type: Boolean,
      default: false,
    },
    site_setting_update: {
      type: Boolean,
      default: false,
    },
    order_show: {
      type: Boolean,
      default: false,
    },
    order_update: {
      type: Boolean,
      default: false,
    },
    offer_order_update: {
      type: Boolean,
      default: false,
    },
    offer_order_show: {
      type: Boolean,
      default: false,
    },
    customer_create: {
      type: Boolean,
      default: false,
    },
    customer_update: {
      type: Boolean,
      default: false,
    },
    customer_delete: {
      type: Boolean,
      default: false,
    },
    customer_show: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const RoleModel = model<IRoleInterface>("roles", roleSchema);

export default RoleModel;
