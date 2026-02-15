// import express from "express"
// import { saveUserPortfolio } from "../controllers/portfolio.controller.js"

// const router = express.Router();


// router.post("/", saveUserPortfolio)


// export default router;







import express from "express";
import { runPythonAndUploadPortfolio } from "../controllers/portfolio.controller.js";

const router = express.Router();

// POST /api/v1/portfolio → run test2.py, then read portfolio_holdings.json and upload to MongoDB
router.post("/", runPythonAndUploadPortfolio);

export default router;
