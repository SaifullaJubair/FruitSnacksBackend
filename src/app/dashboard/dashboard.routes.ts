import express from "express";
import { findDashboardDataServices } from "./dashboard.controllers";
const router = express.Router();

// Get dashboard data
router
  .route("/")
  .get(findDashboardDataServices)

export const DashboardRoutes = router;
