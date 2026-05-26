import express from "express";
import { productFeedXml } from "./productFeed.controllers";

const router = express.Router();
router.route("/feed.xml").get(productFeedXml);
export const ProductFeedRoutes = router;
