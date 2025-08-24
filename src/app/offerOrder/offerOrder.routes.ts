import express from "express";
import {
  findAllDashboardOfferOrder,
  getACustomerAllOfferOrder,
  getAOfferOrderWithOrderProducts,
  postOfferOrder,
  updateOfferOrder,
} from "./offerOrder.controller";
import { verifyToken } from "../../middlewares/verify.token";
const router = express.Router();

// post OfferOrder and get a cuustomer all OfferOrder
router
  .route("/")
  .post(postOfferOrder)
  .get(getACustomerAllOfferOrder)
  .patch(verifyToken("offer_order_update"), updateOfferOrder);

// get all dashboard OfferOrder
router.route("/dashboard").get( verifyToken("offer_order_show"), findAllDashboardOfferOrder);

// get a OfferOrder with OfferOrder details and OfferOrder products
router.route("/:_id").get(getAOfferOrderWithOrderProducts);

export const OfferOrderRoutes = router;
