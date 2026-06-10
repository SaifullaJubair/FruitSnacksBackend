import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import { newsletterLimiter } from "../../middlewares/rate.limit";
import {
  deleteSubscriber,
  exportSubscribersCsv,
  findAllSubscribers,
  subscribe,
} from "./newsletterSubscriber.controllers";

const router = express.Router();

// Public — storefront subscription (rate-limited)
router.route("/subscribe").post(newsletterLimiter, subscribe);

// Admin — list + delete + CSV export
router.route("/").get(verifyToken("newsletter_show"), findAllSubscribers);
router.route("/export").get(verifyToken("newsletter_export"), exportSubscribersCsv);
router.route("/:id").delete(verifyToken("newsletter_delete"), deleteSubscriber);

export const NewsletterSubscriberRoutes = router;
