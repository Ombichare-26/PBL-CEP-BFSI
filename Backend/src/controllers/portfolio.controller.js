
// import fs from "fs";
// import path from "path";
// import { execFile } from "child_process";
// import { promisify } from "util";
import UserPortfolio from "../models/User_Portfolio.model.js";

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
