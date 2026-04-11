import {
  getRiskMasterCoverage,
  importRiskLevels,
  parseRiskImportFile,
  syncAmfiMasterFromNav,
} from "../services/masterData/amfiMaster.service.js";

export async function syncAmfiMasterNav(req, res) {
  try {
    const result = await syncAmfiMasterFromNav();
    res.status(200).json({
      success: true,
      message: "AMFI master synced from official NAV feed.",
      data: result,
    });
  } catch (error) {
    res.status(502).json({
      success: false,
      message: "Failed to sync AMFI master from NAV feed.",
      error: error.message,
    });
  }
}

export async function importAmfiRiskLevels(req, res) {
  try {
    let entries = Array.isArray(req.body?.entries) ? req.body.entries : [];

    if (!entries.length && req.body?.filePath) {
      entries = await parseRiskImportFile(req.body.filePath);
    }

    const result = await importRiskLevels({
      entries,
      overwrite: Boolean(req.body?.overwrite),
      defaultSourceUrl: req.body?.sourceUrl || "",
      defaultSourceType: req.body?.sourceType || "OFFICIAL_IMPORT",
      defaultAsOfDate: req.body?.asOfDate || null,
    });

    res.status(200).json({
      success: true,
      message: "Risk levels imported into AMFI master.",
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to import AMFI risk levels.",
      error: error.message,
    });
  }
}

export async function getAmfiRiskCoverage(_req, res) {
  try {
    const coverage = await getRiskMasterCoverage();
    res.status(200).json({
      success: true,
      data: coverage,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch AMFI master risk coverage.",
      error: error.message,
    });
  }
}
