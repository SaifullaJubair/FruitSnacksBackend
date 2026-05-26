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

router
  .route("/")
  .post(verifyToken("setting_update"), postWarehouse)
  .get(verifyToken("setting_show"), findAllWarehouse);

router.route("/default").get(findDefaultWarehouse);

router
  .route("/:_id")
  .get(verifyToken("setting_show"), findAWarehouse)
  .patch(verifyToken("setting_update"), updateWarehouse)
  .delete(verifyToken("setting_update"), deleteWarehouse);

export const WarehouseRoutes = router;
