import express from "express";
import { fetchCurrentNav } from "../utils/amfiNav.js";
import { fetchHistoricalRiskMetrics } from "../services/recommendation/riskometerUtils.js";

const router = express.Router();

// GET /api/v1/fund/:amfiCode
router.get("/:amfiCode", async (req, res) => {
  try {
    const { amfiCode } = req.params;
    if (!amfiCode) return res.status(400).json({ error: "amfiCode required" });

    const data = await fetchCurrentNav(amfiCode);
    if (!data) return res.status(404).json({ error: "Fund not found" });

    return res.json({ success: true, data });
  } catch (err) {
    console.error("/fund error:", err?.message || err);
    return res.status(500).json({ error: "Failed to fetch fund details" });
  }
});

// GET /api/v1/fund/:amfiCode/history
router.get("/:amfiCode/history", async (req, res) => {
  try {
    const { amfiCode } = req.params;
    if (!amfiCode) return res.status(400).json({ error: "amfiCode required" });

    const historyData = await fetchHistoricalRiskMetrics(amfiCode);
    if (!historyData) return res.status(404).json({ error: "Historical data not found" });

    return res.json({ success: true, data: historyData });
  } catch (err) {
    console.error("/fund history error:", err?.message || err);
    return res.status(500).json({ error: "Failed to fetch historical metrics" });
  }
});

export default router;
