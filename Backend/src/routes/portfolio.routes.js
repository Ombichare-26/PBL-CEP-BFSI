// import express from "express"
// import { saveUserPortfolio } from "../controllers/portfolio.controller.js"

// const router = express.Router();


// router.post("/", saveUserPortfolio)


// export default router;







import express from "express";
import {
  uploadPortfolioFromJSON,
  getPortfolioBySession
} from "../controllers/portfolio.controller.js";

const router = express.Router();

router.post("/", uploadPortfolioFromJSON);

// 🔥 ADD THIS
router.get("/:sessionId", getPortfolioBySession);

export default router;
