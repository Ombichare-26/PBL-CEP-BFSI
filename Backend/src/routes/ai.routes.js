// routes/ai.routes.js
import express from "express";
import { analyzePortfolio } from "../services/recommendation/recommendationEngine.js";

const router = express.Router();

router.post("/evaluate-choice", async (req, res) => {
  try {
    const result = await analyzePortfolio(req.body);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: `AI service unavailable. ${err.message}` });
  }
});

export default router;
