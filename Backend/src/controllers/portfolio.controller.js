
// import fs from "fs";
// import path from "path";
// import { execFile } from "child_process";
// import { promisify } from "util";
import UserPortfolio from "../models/User_Portfolio.model.js";
import AMFIMaster from "../models/AMFI_Master_Fund.model.js";
import { fetchAmfiNavMap } from "../utils/amfiNav.js";
import { fetchSchemeRiskMap } from "../services/recommendation/riskometerUtils.js";

// const execFileAsync = promisify(execFile);
// const backendRoot = process.cwd();
// const scriptPath = path.join(backendRoot, "test2.py");
// const jsonPath = path.join(backendRoot, "portfolio_holdings.json");
// // Use Backend venv Python so pdfplumber etc. are available
// const pythonPath = path.join(backendRoot, "venv", "bin", "python");

/**
 * Run test2.py to generate portfolio_holdings.json, then read the file and upload to MongoDB.
 * Use session_id from req.body.session_id if provided, else fallback to default.
 */
// export const runPythonAndUploadPortfolio = async (req, res) => {
//   try {
//     const sessionId = req.body?.session_id || "6991641efd344970518dee12";

//     // 1. Run Python script (test2.py) from backend root
//     try {
//       await execFileAsync(pythonPath, [scriptPath], {
//         cwd: backendRoot,
//         maxBuffer: 10 * 1024 * 1024
//       });
//     } catch (pyErr) {
//       return res.status(500).json({
//         success: false,
//         message: "Python script (test2.py) failed",
//         error: pyErr.stderr || pyErr.message
//       });
//     }

//     // 2. Read generated JSON
//     const rawData = fs.readFileSync(jsonPath, "utf-8");
//     const extractedData = JSON.parse(rawData);

//     if (!Array.isArray(extractedData) || extractedData.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "No portfolio data in JSON (script may have extracted nothing)."
//       });
//     }

//     // 3. Format and insert into MongoDB
//     const formattedData = extractedData.map((fund) => ({
//       session_id: sessionId,
//       scheme_name: fund.scheme_name,
//       units: fund.units,
//       amfi_code: fund.amfi_code || null,
//       category: fund.category || "OTHER"
//     }));

//     await UserPortfolio.deleteMany({ session_id: sessionId });
//     const savedData = await UserPortfolio.insertMany(formattedData);

//     return res.status(200).json({
//       success: true,
//       message: "Python script ran successfully; portfolio uploaded to MongoDB",
//       data: savedData
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Error running script or uploading portfolio",
//       error: error.message
//     });
//   }
// };

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

    // 2️⃣ Format data for DB
    const formattedData = funds.map((fund) => {
      if (!fund.scheme_name || fund.units === undefined) {
        throw new Error("scheme_name and units are required for each fund");
      }

      return {
        session_id,
        scheme_name: fund.scheme_name,
        units: fund.units,
        amfi_code: fund.amfi_code || null,
        risk_level: fund.risk_level || "",
        risk_source_type: fund.risk_source_type || "",
        risk_source_url: fund.risk_source_url || "",
        risk_match_confidence: Number(fund.risk_match_confidence) || 0,
        risk_lookup_status: fund.risk_lookup_status || "",
        risk_lookup_query: fund.risk_lookup_query || "",
        category: fund.category || "OTHER"
      };
    });

    // 3️⃣ Replace portfolio for session (safe behavior)
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
    const amfiCodes = [...new Set(
      portfolio
        .map((doc) => String(doc.amfi_code || "").trim())
        .filter(Boolean)
    )];
    const masterRows = await AMFIMaster.find(
      { amfi_code: { $in: amfiCodes } },
      {
        amfi_code: 1,
        category: 1,
        risk_level: 1,
        risk_source_type: 1,
        risk_source_url: 1,
        risk_as_of_date: 1,
        risk_last_verified_at: 1,
      }
    ).lean();
    const masterMap = new Map(
      masterRows.map((row) => [String(row.amfi_code), row])
    );
    const schemeRiskMap = await fetchSchemeRiskMap(
      amfiCodes,
      portfolio.map((doc) => {
        const fund = doc.toObject ? doc.toObject() : { ...doc };
        return {
          scheme_name: fund.scheme_name,
          amfi_code: fund.amfi_code,
          category: fund.category || "OTHER",
        };
      })
    );

const data = portfolio.map((doc) => {
  const fund = doc.toObject ? doc.toObject() : { ...doc };

  const rawCode = fund.amfi_code;
  const key = String(rawCode || "").trim();
  const masterEntry = masterMap.get(key);
  const schemeRiskEntry = schemeRiskMap.get(key);

  const navEntry = amfiNavMap.get(key);

  if (navEntry) {
    fund.nav = navEntry.nav;
    fund.current_value = (Number(fund.units) || 0) * navEntry.nav;
  } else {
    fund.nav = 0;
    fund.current_value = 0;
  }

  fund.category = fund.category || "OTHER";
  fund.master_category = masterEntry?.category || "";
  const normalizedSchemeRiskLabel = String(schemeRiskEntry?.riskLabel || "").trim().toUpperCase();
  const hasUsableSchemeRisk = normalizedSchemeRiskLabel && normalizedSchemeRiskLabel !== "UNKNOWN";

  fund.risk_level =
    (hasUsableSchemeRisk ? schemeRiskEntry?.riskLabel : "")
    || masterEntry?.risk_level
    || fund.risk_level
    || "";
  fund.risk_source_type =
    (hasUsableSchemeRisk ? schemeRiskEntry?.riskSource : "")
    || masterEntry?.risk_source_type
    || (masterEntry?.risk_level ? "MASTER_CACHE" : fund.risk_source_type || "");
  fund.risk_source_url =
    (hasUsableSchemeRisk ? schemeRiskEntry?.riskSourceUrl : "")
    || masterEntry?.risk_source_url
    || fund.risk_source_url
    || "";
  fund.risk_as_of_date =
    (hasUsableSchemeRisk ? schemeRiskEntry?.riskAsOfDate : null)
    || masterEntry?.risk_as_of_date
    || null;
  fund.risk_last_verified_at = masterEntry?.risk_last_verified_at || null;
  fund.derived_risk_score = schemeRiskEntry?.derivedRiskScore ?? null;
  fund.volatility_pct = schemeRiskEntry?.volatilityPct ?? null;
  fund.max_drawdown_pct = schemeRiskEntry?.maxDrawdownPct ?? null;
  fund.risk_match_confidence = Number(fund.risk_match_confidence) || 0;
  fund.risk_lookup_status = fund.risk_lookup_status || "";
  fund.risk_lookup_query = fund.risk_lookup_query || "";

  return fund;
});
// console.log("Checking AMFI Code:", amfiCode, typeof amfiCode);
// console.log("Map has key:", amfiNavMap.has(String(amfiCode)));
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
