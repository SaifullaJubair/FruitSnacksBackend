import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import {
  findDashboardDataServices,
  findTopSellingWidgetController,
  findOrdersByStatusWidgetController,
} from "./dashboard.controllers";

const router = express.Router();

// E20 BLOCKER 1 — all dashboard routes gated by dashboard_show
// Previously zero auth: anonymous curl could read all stats + revenue.
router
  .route("/")
  .get(verifyToken("dashboard_show"), findDashboardDataServices);

router
  .route("/widgets/top-selling")
  .get(verifyToken("dashboard_show"), findTopSellingWidgetController);

router
  .route("/widgets/orders-by-status")
  .get(verifyToken("dashboard_show"), findOrdersByStatusWidgetController);

export const DashboardRoutes = router;
