import express from "express";
import {
  deleteACampaignInfo,
  findACampaign,
  findAllCampaign,
  findAllDashboardCampaign,
  findProductToAddCampaign,
  postCampaign,
  updateCampaign,
} from "./campaign.controllers";
import { verifyToken } from "../../middlewares/verify.token";
import { FileUploadHelper } from "../../helpers/image.upload";
const router = express.Router();

// Create, Get Campaign
router
  .route("/")
  .get(findAllCampaign)
  .post(
    verifyToken("campaign_create"),
    FileUploadHelper.ImageUpload.fields([
      { name: "campaign_image", maxCount: 1 },
    ]),
    postCampaign
  )
  .patch(
    verifyToken("campaign_update"),
    FileUploadHelper.ImageUpload.fields([
      { name: "campaign_image", maxCount: 1 },
    ]),
    updateCampaign
  )
  .delete(verifyToken("campaign_delete"), deleteACampaignInfo);

// Admin-only product picker for adding products to a campaign. SHF-1: was
// public + leaked product_buying_price/sku/barcode/alert_qty to anyone.
router
  .route("/dashboard/add_campaign_product")
  .get(verifyToken("campaign_create"), findProductToAddCampaign);

// get all Campaign in dashboard
router.route("/dashboard").get(verifyToken("campaign_show"), findAllDashboardCampaign);

// get a specific Campaign
router.route("/:_id").get(findACampaign);

export const CampaignRoutes = router;
