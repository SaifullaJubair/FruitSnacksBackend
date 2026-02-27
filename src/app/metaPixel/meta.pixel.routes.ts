import express from "express";
import { trackMetaEvent } from "./meta.pixel.controller";

const router = express.Router();

// POST /meta-pixel/event
// Frontend থেকে সব browser events এখানে আসবে
router.route("/event").post(trackMetaEvent);

export const MetaPixelRoutes = router;
