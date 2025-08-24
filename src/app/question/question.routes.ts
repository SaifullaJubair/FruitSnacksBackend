import express from "express";
import {
  deleteAQuestionInfo,
  findAllDashboardQuestion,
  findAllQuestion,
  findUserQuestion,
  postQuestion,
  updateQuestion,
} from "./question.controllers";
import { verifyToken } from "../../middlewares/verify.token";
const router = express.Router();

// Create, Get Question
router
  .route("/")
  .get(findUserQuestion)
  .post(postQuestion)
  .patch(verifyToken("question_update"), updateQuestion)
  .delete(deleteAQuestionInfo);

// get all Question in dashboard
router.route("/dashboard").get(verifyToken("question_show"), findAllDashboardQuestion);

// get Question for a specific product
router.route("/:question_product_id").get(findAllQuestion);

export const QuestionRoutes = router;
