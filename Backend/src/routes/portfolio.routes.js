
import express from "express";
import {
  uploadPortfolioFromJSON,
  getPortfolioBySession
} from "../controllers/portfolio.controller.js";

const router = express.Router();

router.post("/", uploadPortfolioFromJSON);

//  Get portfolio by session ID
router.get("/:sessionId", getPortfolioBySession);

export default router;
