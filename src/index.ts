import express, { Application, NextFunction, Request, Response } from "express";
import cors from "cors";
import connectDB from "./server";
import httpStatus from "http-status";
import routes from "./routes/routes";
import globalErrorHandler from "./middlewares/global.error.handler";
const cookieParser = require("cookie-parser");
import cron from "node-cron";
import CampaignModel from "./app/campaign/campaign.model";
import OfferModel from "./app/offer/offer.model";
import ProductModel from "./app/product/product.model";

const app: Application = express();

app.use(express.json());
// CORS configuration
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:4173",
    "http://localhost:3001",
    "https://fashionforyou.com.bd",
    "https://www.fashionforyou.com.bd",
    "https://admin.fashionforyou.com.bd",
  ], // Allow only this origin
  credentials: true, // Allow credentials
};

app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", async (req: Request, res: Response) => {
  res.send("Jewellery Point BD App is working! YaY!");
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
            { new: true }
          );
        }
      }
    }
  } catch (error) {
    console.error("Error updating campaign status:", error);
  }
};

// Schedule the cron job to run every day at 11:55 PM
cron.schedule("55 23 * * *", () => {
  console.log("Running cron job at 11:55 PM...");
  updateCampaignStatus();
  console.log("Successfully cron job at 11:55 PM...");
});

// Run every second
// setInterval(() => {
//   console.log('Running job every 5 second...');
//   updateCampaignStatus();
// console.log('Successfully cron job...');
// }, 5000);

const port: number | any = process.env.PORT || 8080;
const time = new Date().toLocaleTimeString();
const date = new Date().toLocaleString("en-us", {
  weekday: "short",
  year: "numeric",
  month: "short",
  day: "numeric",
});

app.listen(port, () => {
  console.log(
    "\x1b[36m%s\x1b[0m",
    "[FC]",
    time,
    ":",
    date,
    `: Jewellery Point BD app listening on port ${port}`
  );
});
