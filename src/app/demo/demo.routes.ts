import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import { clearDemoData, getDemoCount } from "./demo.controllers";

const router = express.Router();

// Both gated by the same RBAC flag — only an admin allowed to clear demo data
// should even see the count preview. Super-admin gets it via bootstrap's
// schema-derived all-true role.
router.get("/count", verifyToken("demo_data_clear"), getDemoCount);
router.delete("/clear", verifyToken("demo_data_clear"), clearDemoData);

export const DemoRoutes = router;
