import express from "express";
import { FileUploadHelper } from "../../helpers/image.upload";
import {
  deleteAOfferInfo,
  findAOffer,
  findAllDashboardOffer,
  findAllOffer,
  findProductToAddOffer,
  postOffer,
  updateOffer,
} from "./offer.controllers";
import { verifyToken } from "../../middlewares/verify.token";
const router = express.Router();

// Create, Get Offer
router
  .route("/")
  .get(findAllOffer)
  .post(
    verifyToken("offer_create"),
    FileUploadHelper.ImageUpload.fields([{ name: "offer_image", maxCount: 1 }]),
    postOffer
  )
  .patch(
    verifyToken("offer_update"),
    FileUploadHelper.ImageUpload.fields([{ name: "offer_image", maxCount: 1 }]),
    updateOffer
  )
  .delete(verifyToken("offer_delete"), deleteAOfferInfo);

// get all Offer in dashboard
router.route("/dashboard").get(verifyToken("offer_show"), findAllDashboardOffer);

// get all Offer product to add
router
  .route("/dashboard/add_offer_product")
  .get(findProductToAddOffer);

// get a specific Offer
router.route("/:_id").get(findAOffer);

export const OfferRoutes = router;
