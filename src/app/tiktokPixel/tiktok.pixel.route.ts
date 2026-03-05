import express from "express";
import { trackTikTokEvent } from "./tiktok.pixel.controller";

const TikTokPixelRouter = express.Router();

TikTokPixelRouter.post("/event", trackTikTokEvent);

export default TikTokPixelRouter;
