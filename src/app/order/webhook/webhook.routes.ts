// webhook.routes.ts
import express from "express";
import { steadfastWebhookController } from "./webhook.controller";

const router = express.Router();

// Steadfast webhook — কোনো auth middleware লাগবে না
// Steadfast নিজে থেকে POST করবে এই URL এ
router.route("/steadfast").post(steadfastWebhookController);

export const WebhookRoutes = router;
