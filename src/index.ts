import dotenv from "dotenv";
dotenv.config();
import { validateEnv } from "./utils/env";
// F001: fail fast if required envs missing. Must run before any code reads
// process.env (auth.tokens, server, S3 uploader).
validateEnv();

import express, { Application, NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import connectDB from "./server";
import httpStatus from "http-status";
import routes from "./routes/routes";
import globalErrorHandler from "./middlewares/global.error.handler";
import { responseContext } from "./middlewares/response.context";
import v2Router from "./app/v2/v2.routes";
import { logger } from "./utils/logger";
const cookieParser = require("cookie-parser");
import cron from "node-cron";
import CampaignModel from "./app/campaign/campaign.model";
import OfferModel from "./app/offer/offer.model";
import ProductModel from "./app/product/product.model";
import { warmAnyAscii } from "./helpers/anyAscii";

const app: Application = express();

// F002: required for rate-limit `req.ip` to be the real client IP through
// Coolify's reverse proxy. "1" = trust the first proxy hop only (safe — don't
// blindly trust spoofed X-Forwarded-For from arbitrary upstreams).
app.set("trust proxy", 1);

// §9.1 envelope context — must run before everything so res.locals carries
// requestId/path/method/timestamp for every response (success and error).
app.use(responseContext);

// F003: security headers (helmet). CSP intentionally off — needs separate
// session to map all external sources (S3, pixels, SSLCommerz iframe). See
// finding F003b for the deferred plan.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// F006: explicit body size limit. Default 100kb is fine for ~99% of payloads;
// 200kb gives 2x headroom for the rich-text page-content patch without
// enabling body-bomb DoS. File uploads use multer with its own limits.
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: true, limit: "200kb" }));

// CORS configuration
// F007 — origins are env-driven so each resale client only edits CORS_ORIGINS
// (comma-separated, https) at deploy time instead of editing this file. The
// hardcoded fruitsnacksbd.com list (incl. insecure http:// admin domains) was
// removed. Local dev origins are always allowed so `npm run dev` just works.
const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:4173",
];

const envOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: [...DEV_ORIGINS, ...envOrigins],
  credentials: true, // Allow credentials
};

app.use(cors(corsOptions));
app.use(cookieParser());

// F005 (partial): pino-http logs every request with auto request ID + duration
// + status. Replaces ad-hoc console logs at the request level. Module-level
// console.* migrate gradually as the audit visits each module.
app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    // Don't log bodies — may contain PII (phone, OTP, password).
    serializers: {
      req: (req) => ({ method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }),
);

app.get("/", async (req: Request, res: Response) => {
  res.send("FruitSnacks Server is working!");
});

// Import All Api
app.use("/api/v1", routes);

// V2 clean REST layer (brand/category/... ) — alongside V1, never replaces it.
app.use("/api/v2", v2Router);

//global error handler
app.use(globalErrorHandler);

//handle not found — same §9.1 envelope so the V2 apiClient sees a consistent
// error shape (error.code NOT_FOUND) on unmatched routes too.
app.use((req: Request, res: Response, _next: NextFunction) => {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    statusCode: httpStatus.NOT_FOUND,
    message: "Not Found",
    data: null,
    error: {
      code: "NOT_FOUND",
      message: "API Not Found",
      details: [{ path: req.originalUrl, message: "API Not Found" }],
    },
    path: res.locals.path ?? req.originalUrl,
    method: res.locals.method ?? req.method,
    requestId: res.locals.requestId,
    timestamp: res.locals.timestamp ?? new Date().toISOString(),
  });
});

//connect to db
connectDB();

// Eager-load the ESM-only any-ascii transliterator so the sync slug/SKU paths
// have it ready (see helpers/anyAscii.ts). Fire-and-forget; the wrapper also
// self-warms on require, this just guarantees the module is referenced/bundled.
void warmAnyAscii();

// Function to update campaign status
const updateCampaignStatus = async () => {
  const currentDate = new Date().toISOString().split("T")[0]; // Get current date in YYYY-MM-DD format

  try {
    const offerFound = await OfferModel.find({ offer_end_date: currentDate });

    if (offerFound.length > 0) {
      for (const offer of offerFound) {
        offer.offer_status = "in-active";
        await offer.save();
      }
    }

    const campaignFound: any = await CampaignModel.find({
      campaign_end_date: currentDate,
    });

    if (campaignFound.length > 0) {
      for (const campaign of campaignFound) {
        campaign.campaign_status = "in-active";
        await campaign.save();
        // Loop through campaign_products and update corresponding products
        for (const campaignProduct of campaign?.campaign_products) {
          const productId = campaignProduct?.campaign_product_id;

          // Update the product's product_campaign_id to null
          await ProductModel.findByIdAndUpdate(
            productId,
            { $unset: { product_campaign_id: 1 } },
            { new: true },
          );
        }
      }
    }
  } catch (error) {
    logger.error({ err: error }, "Error updating campaign status");
  }
};

// Schedule the cron job to run every day at 23:55 UTC.
// Pin the timezone explicitly — without it node-cron uses the server's local
// TZ, which on the VPS is not UTC, so the run time drifted from the documented
// "23:55 UTC".
cron.schedule(
  "55 23 * * *",
  () => {
    logger.info("Running daily campaign/offer status cron at 23:55 UTC");
    updateCampaignStatus();
  },
  { timezone: "UTC" },
);

const port: number | any = process.env.PORT || 8080;

app.listen(port, () => {
  logger.info({ port }, `FruitSnacks server listening on port ${port}`);
});
