import { Types } from "mongoose";
import { IAdminInterface } from "../adminRegLog/admin.interface";

export interface IRoleInterface {
  _id?: any;
  role_name: string;
  role_publisher_id?: Types.ObjectId | IAdminInterface;
  role_updated_by?: Types.ObjectId | IAdminInterface;
  category_post?: true | false;
  category_update?: true | false;
  category_delete?: true | false;
  category_show?: true | false;
  brand_post?: true | false;
  brand_update?: true | false;
  brand_show?: true | false;
  brand_delete?: true | false;
  attribute_post?: true | false;
  attribute_update?: true | false;
  attribute_show?: true | false;
  attribute_delete?: true | false;
  specification_post?: true | false;
  specification_update?: true | false;
  specification_show?: true | false;
  specification_delete?: true | false;
  product_create?: true | false;
  product_update?: true | false;
  product_delete?: true | false;
  product_show?: true | false;
  offer_create?: true | false;
  offer_update?: true | false;
  offer_delete?: true | false;
  offer_show?: true | false;
  campaign_create?: true | false;
  campaign_update?: true | false;
  campaign_delete?: true | false;
  campaign_show?: true | false;
  user_create?: true | false;
  user_update?: true | false;
  user_delete?: true | false;
  user_show?: true | false;
  role_create?: true | false;
  role_update?: true | false;
  role_delete?: true | false;
  role_show?: true | false;
  review_update?: true | false;
  review_show?: true | false;
  review_seed_bulk?: true | false;
  review_seed_manual?: true | false;
  question_update?: true | false;
  question_show?: true | false;
  coupon_create?: true | false;
  coupon_update?: true | false;
  coupon_delete?: true | false;
  coupon_show?: true | false;
  banner_create?: true | false;
  banner_update?: true | false;
  banner_delete?: true | false;
  banner_show?: true | false;
  slider_create?: true | false;
  slider_update?: true | false;
  slider_delete?: true | false;
  slider_show?: true | false;
  site_setting_update?: true | false;
  // S4+S5 Phase 1A — CAPI tokens + provider passwords gated by this
  // separate flag so general settings-admins cannot rotate the owner's
  // Meta/TikTok access tokens or read SMS/email/courier credentials.
  setting_secrets_update?: true | false;
  page_seo_show?: true | false;
  page_seo_update?: true | false;
  order_show?: true | false;
  order_update?: true | false;
  customer_create?: true | false;
  customer_update?: true | false;
  customer_delete?: true | false;
  customer_show?: true | false;

  // Dynamic Product Page System
  theme_show?: true | false;
  theme_create?: true | false;
  theme_update?: true | false;
  theme_delete?: true | false;
  demo_data_clear?: true | false;
  faq_template_show?: true | false;
  faq_template_create?: true | false;
  faq_template_update?: true | false;
  faq_template_delete?: true | false;
  trust_point_show?: true | false;
  trust_point_update?: true | false;

  // E20: Dashboard — revenue data must not leak to warehouse/limited staff
  dashboard_show?: true | false;

  // D18: POS admin order create
  order_create_admin?: true | false;

  // M2: Supplier (previously gated with verifyToken("") = any logged-in admin)
  supplier_show?: true | false;
  supplier_create?: true | false;
  supplier_update?: true | false;
  supplier_delete?: true | false;

  // M3: Payment withdraw + payment method (previously had NO auth at all)
  payment_withdraw_show?: true | false;
  payment_withdraw_create?: true | false;
  payment_withdraw_update?: true | false;
  payment_withdraw_delete?: true | false;
  payment_method_show?: true | false;
  payment_method_create?: true | false;
  payment_method_update?: true | false;
  payment_method_delete?: true | false;

  // Track D: Site FAQ
  site_faq_show?: true | false;
  site_faq_post?: true | false;
  site_faq_update?: true | false;
  site_faq_delete?: true | false;

  // Track D: Newsletter Subscribers
  newsletter_show?: true | false;
  newsletter_delete?: true | false;
  newsletter_export?: true | false;
}
