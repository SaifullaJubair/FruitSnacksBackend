import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import {
  getAllPageSeo,
  getPageSeoByKey,
  updatePageSeo,
  seedPageSeo,
} from "./pageSeo.controller";

const PageSeoRouter = express.Router();

// Public route — frontend থেকে data নেওয়ার জন্য
PageSeoRouter.get("/:key", getPageSeoByKey);

// Protected routes — admin panel থেকে manage করার জন্য
PageSeoRouter.get("/", verifyToken("page_seo_show"), getAllPageSeo);
PageSeoRouter.put("/:key", verifyToken("page_seo_update"), updatePageSeo);

// Seed route — শুধু development এ run করো (optional: add auth here too)
PageSeoRouter.post("/seed", seedPageSeo);

export default PageSeoRouter;
