import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import {
  deleteASupplierInfo,
  findAllDashboardSupplier,
  findAllSupplier,
  postSupplier,
  updateSupplier,
} from "./supplier.controllers";
const router = express.Router();

// Create, Get Supplier
router
  .route("/")
  .get(findAllSupplier)
  .post(verifyToken(""), postSupplier)
  .patch(verifyToken(""), updateSupplier)
  .delete(verifyToken(""), deleteASupplierInfo);

// get all Supplier in dashboard
router.route("/dashboard").get(verifyToken(""), findAllDashboardSupplier);

export const SupplierRoutes = router;
