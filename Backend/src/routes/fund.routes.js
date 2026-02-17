import express from "express";
import { getFundDetails, getFundHistoricalNav } from "../controllers/fund.controller.js";

const router = express.Router();

// IMPORTANT: More specific routes must come before parameterized routes
// GET /api/v1/fund/:amfiCode/historical?period=1d|1m|3m|1y|5y - Get historical NAV data
router.get("/:amfiCode/historical", getFundHistoricalNav);

// GET /api/v1/fund/:amfiCode - Get fund details (live price, day change, historical NAV)
router.get("/:amfiCode", getFundDetails);

export default router;
