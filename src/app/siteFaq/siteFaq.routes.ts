import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import {
  deleteSiteFaq,
  findActiveSiteFaq,
  findAllSiteFaq,
  postSiteFaq,
  updateSiteFaq,
} from "./siteFaq.controllers";

const router = express.Router();

// Public — storefront home FAQ section
router.route("/active").get(findActiveSiteFaq);

// Admin — full CRUD
router.route("/").get(verifyToken("site_faq_show"), findAllSiteFaq);
router.route("/").post(verifyToken("site_faq_post"), postSiteFaq);
router.route("/:id").patch(verifyToken("site_faq_update"), updateSiteFaq);
router.route("/:id").delete(verifyToken("site_faq_delete"), deleteSiteFaq);

export const SiteFaqRoutes = router;
