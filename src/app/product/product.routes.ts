import express from "express";
import { FileUploadHelper } from "../../helpers/image.upload";
import {
  checkProductBarcode,
  checkProductBarcodeWhenUpdate,
  deleteAProductInfo,
  findADashboardProduct,
  findAllDashboardProduct,
  findAllDashboardProductRich,
  patchProductQuick,
  patchProductImages,
  findAProductDetails,
  findBrandMatchProduct,
  findCartProduct,
  findCompareProduct,
  findFaqPlaceholderKeys,
  findECommerceChoiceProduct,
  findTopSellingProduct,
  findNewArrivalProduct,
  findMostViewedProduct,
  findJustForYouProduct,
  findPopularProduct,
  findRelatedProduct,
  findTrendingProduct,
  postProduct,
  updateProduct,
  patchProductPageContent,
  findLowStock,
  generateProductQr,
  bumpProductViewCount,
  lookupProductByQrCode,
  ensureBarcodeImage,
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

// Sprint 3 — new semantic strip routes
router.route("/top_selling").get(findTopSellingProduct);
router.route("/new_arrival").get(findNewArrivalProduct);
router.route("/most_viewed").get(findMostViewedProduct);

// find all JustForYou product
router.route("/just_for_you_product").get(findJustForYouProduct);

// find all related product
router.route("/related_product").get(findRelatedProduct);

// find all EcommerceChoice product (deprecated — kept for backward compat, remove after FE migration)
router.route("/ecommerce_choice_product").get(findECommerceChoiceProduct);

// get low-stock products & variations (admin)
router.route("/low_stock").get(verifyToken("product_show"), findLowStock);

// Phase F: generate QR for a product (admin) + bump view count (public)
router.route("/qr").post(verifyToken("product_update"), generateProductQr);
router.route("/view-count").post(bumpProductViewCount);

// Phase 0.5+ Option 1: lazy barcode image generation. Admin print modal calls
// this when it has the barcode NUMBER but no IMAGE URL. Idempotent — returns
// cached URL if already generated.
router
  .route("/ensure-barcode-image")
  .post(verifyToken("product_update"), ensureBarcodeImage);

// Phase 1 (redesigned): public lookup by /q/<short_code> for the storefront
// short-URL redirect route. No auth — printed QR labels are public artifacts.
router.route("/by-qr-code/:code").get(lookupProductByQrCode);

// get all dashboard product
router.route("/dashboard").get(verifyToken("product_show"), findAllDashboardProduct);

// A2 (2026-06-04) — operational list with computed fields (variation_count,
// stock_total, low/out flags, has_theme, has_page_content). Used by the
// rewritten admin product list page.
router
  .route("/dashboard-rich")
  .get(verifyToken("product_show"), findAllDashboardProductRich);

// A2 — whitelisted partial update for the inline toggles + per-column edit
// modals (price/stock/etc). Avoids the full-rebuild trap on /product PATCH.
router.route("/quick").patch(verifyToken("product_update"), patchProductQuick);

// A2 — Images modal: main swap, add to other, reorder, remove. Body field
// `mode` chooses the operation. Files via multer.any().
router
  .route("/images")
  .patch(
    verifyToken("product_update"),
    // MediaUpload (20 MB) instead of ImageUpload (10 MB) so the swap_video mode
    // can replace short product videos through this same safe partial route.
    FileUploadHelper.MediaUpload.any(),
    patchProductImages,
  );

// get a dashboard product
//
// Admin-only, like the /dashboard list route above — this single-doc variant
// was the one that got missed. It returns product_buying_price and every
// variation's variation_buying_price (the shop's cost prices), plus SKUs and
// barcodes, so an anonymous request could read the margins for any guessable
// product id. Its only callers are the admin's stock + variations modals, both
// of which already send credentials; the storefront never touches it.
router
  .route("/dashboard/:_id")
  .get(verifyToken("product_show"), findADashboardProduct);

// get cart product details (POST — body avoids URL length limits on large carts)
router.route("/cart_product").post(findCartProduct);

// get compare product details
router.route("/compare_product").get(findCompareProduct);

// distinct FAQ placeholder keys across the catalog (admin chip picker).
// MUST stay above "/:product_slug" so it isn't captured as a slug.
router
  .route("/faq-placeholder-keys")
  .get(verifyToken("product_show"), findFaqPlaceholderKeys);

// get a product details
router.route("/:product_slug").get(findAProductDetails);

export const ProductRoutes = router;
