// webhook.routes.ts
import express from "express";
import { steadfastWebhookController } from "./webhook.controller";
import { pathaoWebhookController } from "./pathao.webhook.controller";

const router = express.Router();

// Steadfast webhook — কোনো auth middleware লাগবে না
// Steadfast নিজে থেকে POST করবে এই URL এ
router.route("/steadfast").post(steadfastWebhookController);

// Pathao webhook — auth নেই, Pathao নিজে POST করে
// Response must be 202
router.route("/pathao").post(pathaoWebhookController);

export const WebhookRoutes = router;
