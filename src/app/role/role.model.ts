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
    review_seed_bulk: {
      type: Boolean,
      default: false,
    },
    review_seed_manual: {
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
    // S4+S5 Phase 1A — owner/superadmin only by default.
    setting_secrets_update: {
      type: Boolean,
      default: false,
    },
    page_seo_show: {
      type: Boolean,
      default: false,
    }, 
    page_seo_update: {
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

    // ===== Dynamic Product Page System =====
    theme_show: {
      type: Boolean,
      default: false,
    },
    theme_create: {
      type: Boolean,
      default: false,
    },
    theme_update: {
      type: Boolean,
      default: false,
    },
    theme_delete: {
      type: Boolean,
      default: false,
    },
    // One-click "Clear demo data" (removes is_demo catalog rows). Default false
    // so only the super-admin (schema-derived all-true role) gets it; the owner
    // can grant it to a custom role from Admin → Roles.
    demo_data_clear: {
      type: Boolean,
      default: false,
    },
    faq_template_show: {
      type: Boolean,
      default: false,
    },
    faq_template_create: {
      type: Boolean,
      default: false,
    },
    faq_template_update: {
      type: Boolean,
      default: false,
    },
    faq_template_delete: {
      type: Boolean,
      default: false,
    },
    trust_point_show: {
      type: Boolean,
      default: false,
    },
    trust_point_update: {
      type: Boolean,
      default: false,
    },

    // ===== E20: Dashboard =====
    dashboard_show: { type: Boolean, default: false },

    // ===== D18: POS admin order create =====
    order_create_admin: { type: Boolean, default: false },

    // ===== M2: Supplier =====
    supplier_show: { type: Boolean, default: false },
    supplier_create: { type: Boolean, default: false },
    supplier_update: { type: Boolean, default: false },
    supplier_delete: { type: Boolean, default: false },

    // ===== M3: Payment withdraw + payment method =====
    payment_withdraw_show: { type: Boolean, default: false },
    payment_withdraw_create: { type: Boolean, default: false },
    payment_withdraw_update: { type: Boolean, default: false },
    payment_withdraw_delete: { type: Boolean, default: false },
    payment_method_show: { type: Boolean, default: false },
    payment_method_create: { type: Boolean, default: false },
    payment_method_update: { type: Boolean, default: false },
    payment_method_delete: { type: Boolean, default: false },

    // ===== Track D: Site FAQ =====
    site_faq_show: { type: Boolean, default: false },
    site_faq_post: { type: Boolean, default: false },
    site_faq_update: { type: Boolean, default: false },
    site_faq_delete: { type: Boolean, default: false },

    // ===== Track D: Newsletter Subscribers =====
    newsletter_show: { type: Boolean, default: false },
    newsletter_delete: { type: Boolean, default: false },
    newsletter_export: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
);

const RoleModel = model<IRoleInterface>("roles", roleSchema);

export default RoleModel;
