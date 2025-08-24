import express from "express";
import { ImageUploadRoutes } from "../helpers/frontend/imageUpload/imageUpload.routes";
import { CategoryRoutes } from "../app/category/category.routes";
import { Sub_CategoryRoutes } from "../app/sub_category/sub_category.routes";
import { Child_CategoryRoutes } from "../app/child_category/child_category.routes";
import { BrandRoutes } from "../app/brand/brand.routes";
import { SpecificationRoutes } from "../app/specification/specification.routes";
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
import { OfferOrderRoutes } from "../app/offerOrder/offerOrder.routes";
import { DashboardRoutes } from "../app/dashboard/dashboard.routes";

const router = express.Router();

const moduleRoutes = [
  {
    path: "/category",
    route: CategoryRoutes,
  },
  {
    path: "/sub_category",
    route: Sub_CategoryRoutes,
  },
  {
    path: "/child_category",
    route: Child_CategoryRoutes,
  },
  {
    path: "/brand",
    route: BrandRoutes,
  },
  {
    path: "/specification",
    route: SpecificationRoutes,
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
    path: "/order",
    route: OrderRoutes,
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
    path: "/offer_order",
    route: OfferOrderRoutes,
  },
  {
    path: "/dashboard",
    route: DashboardRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));
export default router;
