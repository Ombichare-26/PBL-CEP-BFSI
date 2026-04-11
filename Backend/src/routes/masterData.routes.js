import express from "express";
import {
  getAmfiRiskCoverage,
  importAmfiRiskLevels,
  syncAmfiMasterNav,
} from "../controllers/masterData.controller.js";

const router = express.Router();

router.post("/amfi/sync-nav", syncAmfiMasterNav);
router.post("/amfi/import-risk-levels", importAmfiRiskLevels);
router.get("/amfi/risk-coverage", getAmfiRiskCoverage);

export default router;
