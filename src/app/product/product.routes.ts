import express from "express";
import { FileUploadHelper } from "../../helpers/image.upload";
import {
  checkProductBarcode,
  checkProductBarcodeWhenUpdate,
  deleteAProductInfo,
  findADashboardProduct,
  findAllDashboardProduct,
  findAProductDetails,
  findBrandMatchProduct,
  findCartProduct,
  findCompareProduct,
  findECommerceChoiceProduct,
  findJustForYouProduct,
  findPopularProduct,
  findRelatedProduct,
  findTrendingProduct,
  postProduct,
  updateProduct,
  patchProductPageContent,
} from "./product.controllers";
import { verifyToken } from "../../middlewares/verify.token";
const router = express.Router();

router
  .route("/")
  .post(verifyToken("product_create"), FileUploadHelper.ImageUpload.any(), postProduct)
  .patch(verifyToken("product_update"), FileUploadHelper.ImageUpload.any(), updateProduct)
  .delete(verifyToken("product_delete"), deleteAProductInfo);

// Partial JSON update for the themed Page Content form (no file upload).
// Declared before "/:product_slug" so it isn't swallowed by that param route.
router
  .route("/page-content")
  .patch(verifyToken("product_update"), patchProductPageContent);

// check product barcode
router.route("/check_product_barcode").post(checkProductBarcode);

// check product barcode when update
router
  .route("/check_product_barcode_when_update")
  .post(checkProductBarcodeWhenUpdate);

// find all trending product
router.route("/trending_product").get(findTrendingProduct);

// find all brand_match product
router.route("/brand_match_product").get(findBrandMatchProduct);

// find all Popular product
router.route("/popular_product").get(findPopularProduct);

// find all JustForYou product
router.route("/just_for_you_product").get(findJustForYouProduct);

// find all related product
router.route("/related_product").get(findRelatedProduct);

// find all EcommerceChoice product
router.route("/ecommerce_choice_product").get(findECommerceChoiceProduct);

// get all dashboard product
router.route("/dashboard").get(verifyToken("product_show"), findAllDashboardProduct);

// get a dashboard product
router.route("/dashboard/:_id").get(findADashboardProduct);

// get cart product details
router.route("/cart_product").get(findCartProduct);

// get compare product details
router.route("/compare_product").get(findCompareProduct);

// get a product details
router.route("/:product_slug").get(findAProductDetails);

export const ProductRoutes = router;
