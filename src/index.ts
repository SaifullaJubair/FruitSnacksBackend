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
import { logger } from "./utils/logger";
const cookieParser = require("cookie-parser");
import cron from "node-cron";
import CampaignModel from "./app/campaign/campaign.model";
import OfferModel from "./app/offer/offer.model";
import ProductModel from "./app/product/product.model";

const app: Application = express();

// F002: required for rate-limit `req.ip` to be the real client IP through
// Coolify's reverse proxy. "1" = trust the first proxy hop only (safe — don't
// blindly trust spoofed X-Forwarded-For from arbitrary upstreams).
app.set("trust proxy", 1);

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
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:4173",
    "http://localhost:3001",
    "http://admin.fruitsnacksbd.com",
    "http://www.admin.fruitsnacksbd.com",
    "http://dev-admin.fruitsnacksbd.com",
    "http://www.dev-admin.fruitsnacksbd.com",
    "https://fruitsnacksbd.com",
    "https://www.fruitsnacksbd.com",
    "https://dev.fruitsnacksbd.com",
    "https://www.dev.fruitsnacksbd.com",
    "https://admin.fruitsnacksbd.com",
    "https://www.admin.fruitsnacksbd.com",
    "https://dev-admin.fruitsnacksbd.com",
    "https://www.dev-admin.fruitsnacksbd.com",
    "https://fruitsnacks-frontend.vercel.app",
  ], // Allow only this origin
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

//global error handler
app.use(globalErrorHandler);

//handle not found
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    message: "Not Found",
    errorMessages: [
      {
        path: req.originalUrl,
        message: "API Not Found",
      },
    ],
  });
  next();
});

//connect to db
connectDB();

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

// Schedule the cron job to run every day at 11:55 PM
cron.schedule("55 23 * * *", () => {
  logger.info("Running daily campaign/offer status cron at 23:55");
  updateCampaignStatus();
});

const port: number | any = process.env.PORT || 8080;

app.listen(port, () => {
  logger.info({ port }, `FruitSnacks server listening on port ${port}`);
});
