

import UserPortfolio from "../models/User_Portfolio.model.js";
import { fetchAmfiNavMap } from "../utils/amfiNav.js";
import { fetchSchemeRiskMap } from "../services/recommendation/riskometerUtils.js";




/** Legacy: upload from existing portfolio_holdings.json without running Python. */
export const uploadPortfolioFromJSON = async (req, res) => {
  try {
    const { session_id, funds } = req.body;

    // 1️⃣ Basic validations
    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: "session_id is required"
      });
    }

    if (!Array.isArray(funds) || funds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "funds array is required"
      });
    }

    // 2️⃣ Setup AMFI codes for batch Gemini checking
    const validFunds = funds.filter(
      (f) => f.amfi_code && f.amfi_code !== "NOT_FOUND" && f.amfi_code.trim() !== ""
    );
    const amfiCodes = [...new Set(validFunds.map((f) => String(f.amfi_code).trim()))];
    // Fast local lookup to populate already known risks instantly
    const schemeRiskMap = await fetchSchemeRiskMap(amfiCodes, validFunds, { allowGemini: false, allowDerivedFallback: false });

    // Fire-and-forget background Gemini lookup for missing risks (bypassing 24h failure cache)
    fetchSchemeRiskMap(amfiCodes, validFunds, { allowGemini: true, allowDerivedFallback: false, forceRetryGemini: true }).catch((err) => {
      console.error("Background Gemini fetch failed:", err);
    });

    // 3️⃣ Format data for DB
    const formattedData = funds.map((fund) => {
      if (!fund.scheme_name || fund.units === undefined) {
        throw new Error("scheme_name and units are required for each fund");
      }

      const key = String(fund.amfi_code || "").trim();
      const schemeRiskEntry = schemeRiskMap.get(key);
      const normalizedSchemeRiskLabel = String(schemeRiskEntry?.riskLabel || "").trim().toUpperCase();
      const hasUsableSchemeRisk = normalizedSchemeRiskLabel && normalizedSchemeRiskLabel !== "UNKNOWN";

      // Do NOT overwrite valid existing risk with UNKNOWN
      let finalRiskLevel = fund.risk_level || "";
      if (hasUsableSchemeRisk) {
        finalRiskLevel = schemeRiskEntry?.riskLabel;
      }

      return {
        session_id,
        scheme_name: fund.scheme_name,
        units: fund.units,
        amfi_code: fund.amfi_code || null,
        risk_level: finalRiskLevel,
        risk_source_type: (hasUsableSchemeRisk ? schemeRiskEntry?.riskSource : fund.risk_source_type) || "",
        risk_source_url: (hasUsableSchemeRisk ? schemeRiskEntry?.riskSourceUrl : fund.risk_source_url) || "",
        risk_last_verified_at: schemeRiskEntry?.riskLastVerifiedAt || null,
        risk_match_confidence: Number(fund.risk_match_confidence) || 0,
        risk_lookup_status: schemeRiskEntry?.lookupStatus || fund.risk_lookup_status || "",
        risk_lookup_query: fund.risk_lookup_query || "",
        category: fund.category || "OTHER"
      };
    });

    // 4️⃣ Replace portfolio for session (safe behavior)
    await UserPortfolio.deleteMany({ session_id });

    const savedData = await UserPortfolio.insertMany(formattedData);

    return res.status(201).json({
      success: true,
      message: "Portfolio uploaded successfully",
      data: savedData
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error uploading portfolio",
      error: error.message
    });
  }
};
export const getPortfolioBySession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const portfolio = await UserPortfolio.find({ session_id: sessionId });

    if (!portfolio || portfolio.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Portfolio not found"
      });
    }

    // Fetch AMFI NAV once and enrich each fund with live NAV and current value
    const amfiNavMap = await fetchAmfiNavMap();

    const validFunds = portfolio.filter(
      (f) => f.amfi_code && f.amfi_code !== "NOT_FOUND" && String(f.amfi_code).trim() !== ""
    );
    const amfiCodes = [...new Set(validFunds.map((f) => String(f.amfi_code).trim()))];
    const schemeRiskMap = await fetchSchemeRiskMap(amfiCodes, validFunds, { allowGemini: false });

    const data = portfolio.map((doc) => {
      const fund = doc.toObject ? doc.toObject() : { ...doc };

      const rawCode = fund.amfi_code;
      const key = String(rawCode || "").trim();
      const navEntry = amfiNavMap.get(key);

      if (navEntry) {
        fund.nav = navEntry.nav;
        fund.current_value = (Number(fund.units) || 0) * navEntry.nav;
      } else {
        fund.nav = 0;
        fund.current_value = 0;
      }

      const riskEntry = schemeRiskMap.get(key);
      const normalizedSchemeRiskLabel = String(riskEntry?.riskLabel || "").trim().toUpperCase();
      const hasUsableSchemeRisk = normalizedSchemeRiskLabel && normalizedSchemeRiskLabel !== "UNKNOWN";

      if (hasUsableSchemeRisk) {
        fund.risk_level = riskEntry.riskLabel;
        fund.risk_source_type = riskEntry.riskSource || fund.risk_source_type;
        fund.risk_source_url = riskEntry.riskSourceUrl || fund.risk_source_url;
      }

      fund.category = fund.category || "OTHER";
      fund.derived_risk_score = null;
      fund.volatility_pct = null;
      fund.max_drawdown_pct = null;

      return fund;
    });
    return res.status(200).json({
      success: true,
      data
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching portfolio",
      error: error.message
    });
  }
  
};
