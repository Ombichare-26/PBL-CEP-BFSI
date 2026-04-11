// routes/ai.routes.js
import express from "express";
import { analyzePortfolio } from "../services/recommendation/recommendationEngine.js";
import { chatOnRecommendation } from "../services/recommendation/recommendationChatEngine.js";

const router = express.Router();

router.post("/evaluate-choice", async (req, res) => {
  try {
    const result = await analyzePortfolio(req.body);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: `AI service unavailable. ${err.message}` });
  }
});

router.post("/recommendation-chat", async (req, res) => {
  try {
    const result = await chatOnRecommendation({
      baseRecommendation: req.body?.baseRecommendation || {},
      planningContext: req.body?.planningContext || {},
      chatHistory: Array.isArray(req.body?.chatHistory) ? req.body.chatHistory : [],
      userMessage: req.body?.userMessage || "",
    });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: `AI chatbot unavailable. ${err.message}` });
  }
});

export default router;
