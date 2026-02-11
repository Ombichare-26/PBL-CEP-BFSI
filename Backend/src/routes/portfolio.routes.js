// import express from "express"
// import { saveUserPortfolio } from "../controllers/portfolio.controller.js"

// const router = express.Router();


// router.post("/", saveUserPortfolio)


// export default router;







import express from "express";
import { uploadPortfolioFromJSON } from "../controllers/portfolio.controller.js";

const router = express.Router();

router.post("/", uploadPortfolioFromJSON);

export default router;
