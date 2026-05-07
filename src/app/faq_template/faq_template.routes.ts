import express from "express";
import { verifyToken } from "../../middlewares/verify.token";
import {
  deleteFaqTemplate,
  findAllFaqTemplates,
  findFaqTemplateById,
  patchFaqTemplate,
  postFaqTemplate,
} from "./faq_template.controllers";

const router = express.Router();

router
  .route("/")
  .get(findAllFaqTemplates)
  .post(verifyToken("faq_template_create"), postFaqTemplate);

router
  .route("/:id")
  .get(findFaqTemplateById)
  .patch(verifyToken("faq_template_update"), patchFaqTemplate)
  .delete(verifyToken("faq_template_delete"), deleteFaqTemplate);

export const FaqTemplateRoutes = router;
