import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import {
  postWarehouse,
  findAllWarehouse,
  findAWarehouse,
  updateWarehouse,
  deleteWarehouse,
  findDefaultWarehouse,
} from "./warehouse.controllers";

const router = express.Router();

// NOTE: previously gated by setting_update / setting_show — flags that don't
// exist in role.model.ts, so verifyToken always failed → warehouse CRUD was
// permanently 403 (even for super-admin). Repointed to the existing
// `site_setting_update` flag (warehouse is part of site config). `/default`
// stays public (product form + storefront need the default warehouse).
router
  .route("/")
  .post(verifyToken("site_setting_update"), postWarehouse)
  .get(verifyToken("site_setting_update"), findAllWarehouse);

router.route("/default").get(findDefaultWarehouse);

router
  .route("/:_id")
  .get(verifyToken("site_setting_update"), findAWarehouse)
  .patch(verifyToken("site_setting_update"), updateWarehouse)
  .delete(verifyToken("site_setting_update"), deleteWarehouse);

export const WarehouseRoutes = router;
