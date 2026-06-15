import express from "express";
import { ImageUploadRoutes } from "../helpers/frontend/imageUpload/imageUpload.routes";
import { CategoryRoutes } from "../app/category/category.routes";
import { BrandRoutes } from "../app/brand/brand.routes";
import { AttributeRoutes } from "../app/attribute/attribute.routes";
import { MultiImageUploadRoutes } from "../helpers/frontend/imageUpload/multi_imageUpload.routes";
import { ReviewRoutes } from "../app/review/review.routes";
import { CampaignRoutes } from "../app/campaign/campaign.routes";
import { RoleRoutes } from "../app/role/role.routes";
import { AdminRegRoutes } from "../app/adminRegLog/admin.routes";
import { UserGetMeRoutes } from "../app/getme/getme.routes";
import { ProductRoutes } from "../app/product/product.routes";
import { CouponRoutes } from "../app/coupon/coupon.routes";
import { SupplierRoutes } from "../app/supplier/supplier.routes";
import { BannerRoutes } from "../app/banner/banner.routes";
import { SliderRoutes } from "../app/slider/slider.routes";
import { AuthenticationRoutes } from "../app/authentication/authentication.routes";
import { PaymentMethodRoutes } from "../app/withdrow_payment_method/withdrow_payment_method.routes";
import { SettingRoutes } from "../app/setting/setting.routes";
import { UserRegRoutes } from "../app/user/user.routes";
import { ProductFilterRoutes } from "../app/productFilter/product.filter.routes";
import { PaymentWithdrawListRoutes } from "../app/paymentWithdrawList/paymentWithdrawList.routes";
import { OrderRoutes } from "../app/order/order.routes";
import { QuestionRoutes } from "../app/question/question.routes";
import { OfferRoutes } from "../app/offer/offer.routes";
import { DashboardRoutes } from "../app/dashboard/dashboard.routes";
import { CourierRoutes } from "../app/order/courier/courier.routes";
import { WebhookRoutes } from "../app/order/webhook/webhook.routes";
import { FraudRoutes } from "../app/fraud/fraud.routes";
import { CartRoutes } from "../app/cart/cart.routes";
import { MetaPixelRoutes } from "../app/metaPixel/meta.pixel.routes";
import PageSeoRouter from "../app/pageSeo/pageSeo.route";
import TikTokPixelRouter from "../app/tiktokPixel/tiktok.pixel.route";
import { ThemeRoutes } from "../app/theme/theme.routes";
import { FaqTemplateRoutes } from "../app/faq_template/faq_template.routes";
import { TrustPointRoutes } from "../app/trustPoint/trustPoint.routes";
import { VariationRoutes } from "../app/variation/variation.routes";
import { PaymentRoutes } from "../app/payment/payment.routes";
import { FlashSaleRoutes } from "../app/flashsale/flashsale.routes";
import { WalletRoutes } from "../app/wallet/wallet.routes";
import { WarehouseRoutes } from "../app/warehouse/warehouse.routes";
import { WishlistRoutes } from "../app/wishlist/wishlist.routes";
import { AbandonedCartRoutes } from "../app/abandonedCart/abandonedCart.routes";
import { LoyaltyRoutes } from "../app/loyalty/loyalty.routes";
import { ProductFeedRoutes } from "../app/productFeed/productFeed.routes";
import { SiteFaqRoutes } from "../app/siteFaq/siteFaq.routes";
import { NewsletterSubscriberRoutes } from "../app/newsletterSubscriber/newsletterSubscriber.routes";
import { DemoRoutes } from "../app/demo/demo.routes";

const router = express.Router();

const moduleRoutes = [
  {
    path: "/category",
    route: CategoryRoutes,
  },
  {
    path: "/brand",
    route: BrandRoutes,
  },
  {
    path: "/attribute",
    route: AttributeRoutes,
  },
  {
    path: "/product",
    route: ProductRoutes,
  },
  {
    path: "/filter_product",
    route: ProductFilterRoutes,
  },
  {
    path: "/cart",
    route: CartRoutes,
  },
  {
    path: "/order",
    route: OrderRoutes,
  },
  {
    path: "/payment",
    route: PaymentRoutes,
  },
  {
    path: "/webhook",
    route: WebhookRoutes,
  },
  {
    path: "/courier",
    route: CourierRoutes,
  },
  {
    path: "/fraud",
    route: FraudRoutes,
  },
  {
    path: "/review",
    route: ReviewRoutes,
  },
  {
    path: "/campaign",
    route: CampaignRoutes,
  },
  {
    path: "/coupon",
    route: CouponRoutes,
  },
  {
    path: "/role",
    route: RoleRoutes,
  },
  {
    path: "/admin_reg_log",
    route: AdminRegRoutes,
  },
  {
    path: "/supplier",
    route: SupplierRoutes,
  },
  {
    path: "/user",
    route: UserRegRoutes,
  },
  {
    path: "/get_me",
    route: UserGetMeRoutes,
  },
  {
    path: "/banner",
    route: BannerRoutes,
  },
  {
    path: "/slider",
    route: SliderRoutes,
  },
  {
    path: "/authentication",
    route: AuthenticationRoutes,
  },

  {
    path: "/payment_method",
    route: PaymentMethodRoutes,
  },
  {
    path: "/payment_withdraw",
    route: PaymentWithdrawListRoutes,
  },
  {
    path: "/setting",
    route: SettingRoutes,
  },
  {
    path: "/image_upload",
    route: ImageUploadRoutes,
  },
  {
    path: "/multi_image_upload",
    route: MultiImageUploadRoutes,
  },
  {
    path: "/question",
    route: QuestionRoutes,
  },
  {
    path: "/offer",
    route: OfferRoutes,
  },
  {
    path: "/dashboard",
    route: DashboardRoutes,
  },

  { path: "/meta-pixel", route: MetaPixelRoutes },
  { path: "/tiktok-pixel", route: TikTokPixelRouter },
  { path: "/page-seo", route: PageSeoRouter },
  { path: "/theme", route: ThemeRoutes },
  { path: "/faq-template", route: FaqTemplateRoutes },
  { path: "/trust-point", route: TrustPointRoutes },
  { path: "/variation", route: VariationRoutes },
  { path: "/flash-sale", route: FlashSaleRoutes },
  { path: "/wallet", route: WalletRoutes },
  { path: "/warehouse", route: WarehouseRoutes },
  { path: "/wishlist", route: WishlistRoutes },
  { path: "/abandoned-cart", route: AbandonedCartRoutes },
  { path: "/loyalty", route: LoyaltyRoutes },
  { path: "/product-feed", route: ProductFeedRoutes },
  { path: "/site-faq", route: SiteFaqRoutes },
  { path: "/newsletter-subscriber", route: NewsletterSubscriberRoutes },
  { path: "/demo", route: DemoRoutes },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));
export default router;
