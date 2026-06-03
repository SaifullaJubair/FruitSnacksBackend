import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import { getTrustPoints, putTrustPoints } from "./trustPoint.controllers";

const router = express.Router();

router
  .route("/")
  .get(getTrustPoints)
  .put(verifyToken("trust_point_update"), putTrustPoints);

export const TrustPointRoutes = router;
