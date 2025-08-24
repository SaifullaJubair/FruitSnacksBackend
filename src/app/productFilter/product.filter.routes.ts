import express from "express";
import {
  findAllFilteredProduct,
  findAllHeadingSub_Child_CategoryData,
  findAllSearchTermProduct,
  findAllSideFilteredData,
} from "./product.filter.controllers";
const router = express.Router();

// Get filter product data
router.route("/").get(findAllFilteredProduct);

// get heading sub and child category data
router
  .route("/heading_sub_child_category_data")
  .get(findAllHeadingSub_Child_CategoryData);

// get side filtered data
router.route("/side_filtered_data/:categoryType").get(findAllSideFilteredData);

// get side filtered data
router.route("/search_product").get(findAllSearchTermProduct);

export const ProductFilterRoutes = router;
