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

// M2 fix: previously verifyToken("") accepted any logged-in admin (empty flag
// bypasses the RBAC check). Now wired to real supplier_* permission flags.
router
  .route("/")
  .get(verifyToken("supplier_show"), findAllSupplier)
  .post(verifyToken("supplier_create"), postSupplier)
  .patch(verifyToken("supplier_update"), updateSupplier)
  .delete(verifyToken("supplier_delete"), deleteASupplierInfo);

// get all Supplier in dashboard
router
  .route("/dashboard")
  .get(verifyToken("supplier_show"), findAllDashboardSupplier);

export const SupplierRoutes = router;
