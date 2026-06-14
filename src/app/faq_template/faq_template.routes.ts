import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import {
  deleteFaqTemplate,
  findAllFaqTemplates,
  findFaqTemplateById,
  findFaqTemplateTopics,
  patchFaqTemplate,
  postFaqTemplate,
} from "./faq_template.controllers";

const router = express.Router();

router
  .route("/")
  .get(findAllFaqTemplates)
  .post(verifyToken("faq_template_create"), postFaqTemplate);

// MUST be declared before "/:id" or "topics" gets captured as an :id param
// (the route-ordering pitfall noted in the backend CLAUDE.md).
router.route("/topics").get(findFaqTemplateTopics);

router
  .route("/:id")
  .get(findFaqTemplateById)
  .patch(verifyToken("faq_template_update"), patchFaqTemplate)
  .delete(verifyToken("faq_template_delete"), deleteFaqTemplate);

export const FaqTemplateRoutes = router;
