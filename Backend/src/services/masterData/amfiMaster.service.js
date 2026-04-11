import fs from "fs/promises";
import AMFIMaster from "../../models/AMFI_Master_Fund.model.js";
import { normalizeRiskLabel } from "../recommendation/riskometerUtils.js";

const AMFI_NAV_URL = "https://www.amfiindia.com/spages/NAVAll.txt";

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const dmy = raw.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (dmy) {
    const parsed = new Date(`${dmy[1]} ${dmy[2]} ${dmy[3]} 00:00:00 UTC`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const iso = new Date(raw);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function parseNav(value) {
  const n = parseFloat(String(value || "").trim().replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function looksLikeSchemeLine(line = "") {
  return /^\d+\s*;/.test(String(line || "").trim());
}

function looksLikeCategoryLine(line = "") {
  const text = String(line || "").trim();
  if (!text || text.includes(";")) return false;
  return /fund|scheme|plan|fof|etf|index|hybrid|equity|debt|solution|other/i.test(text);
}

function looksLikeFundHouseLine(line = "") {
  const text = String(line || "").trim();
  if (!text || text.includes(";")) return false;
  if (looksLikeCategoryLine(text)) return false;
  return /mutual fund|amc|asset management/i.test(text);
}

function parseAmfiNavMaster(text) {
  const rows = [];
  let currentFundHouse = "";
  let currentCategory = "";

  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("Scheme Code")) continue;

    if (looksLikeFundHouseLine(line)) {
      currentFundHouse = line;
      continue;
    }

    if (looksLikeCategoryLine(line)) {
      currentCategory = line;
      continue;
    }

    if (!looksLikeSchemeLine(line)) continue;

    const parts = line.split(";").map((part) => part.trim());
    if (parts.length < 6) continue;

    rows.push({
      amfi_code: parts[0],
      isin: parts[1] || "",
      schema_name: parts[3] || "",
      curr_nav: parseNav(parts[4]),
      nav_last_updated: parseDate(parts[5]),
      fund_house: currentFundHouse,
      category: currentCategory,
    });
  }

  return rows.filter((row) => row.amfi_code && row.schema_name);
}

function parseRiskImportEntry(entry = {}) {
  const amfiCode = String(entry.amfi_code || entry.amfiCode || "").trim();
  const riskLevel = normalizeRiskLabel(entry.risk_level || entry.riskLevel);

  if (!amfiCode) {
    throw new Error("Each risk entry must include amfi_code.");
  }
  if (riskLevel === "UNKNOWN") {
    throw new Error(`Risk level for AMFI code ${amfiCode} is missing or invalid.`);
  }

  return {
    amfi_code: amfiCode,
    schema_name: String(entry.schema_name || entry.scheme_name || entry.schemeName || "").trim(),
    risk_level: riskLevel,
    risk_source_url: String(entry.risk_source_url || entry.source_url || entry.sourceUrl || "").trim(),
    risk_source_type: String(entry.risk_source_type || entry.source_type || entry.sourceType || "OFFICIAL_IMPORT").trim(),
    risk_as_of_date: parseDate(entry.risk_as_of_date || entry.as_of_date || entry.asOfDate),
    risk_notes: String(entry.risk_notes || entry.notes || "").trim(),
  };
}

function parseCsvLine(line = "") {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

export async function syncAmfiMasterFromNav() {
  const response = await fetch(AMFI_NAV_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Finercom/1.0)",
    },
  });

  if (!response.ok) {
    throw new Error(`AMFI NAV master sync failed: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const rows = parseAmfiNavMaster(text);
  const now = new Date();

  if (!rows.length) {
    throw new Error("AMFI NAV master sync returned no scheme rows.");
  }

  const operations = rows.map((row) => ({
    updateOne: {
      filter: { amfi_code: row.amfi_code },
      update: {
        $set: {
          schema_name: row.schema_name,
          isin: row.isin || "",
          fund_house: row.fund_house || "",
          category: row.category || "",
          curr_nav: row.curr_nav,
          nav_last_updated: row.nav_last_updated,
          last_master_sync_at: now,
        },
        $setOnInsert: {
          risk_level: "",
          risk_source_type: "",
          risk_source_url: "",
          risk_as_of_date: null,
          risk_last_verified_at: null,
          risk_notes: "",
        },
      },
      upsert: true,
    },
  }));

  const result = await AMFIMaster.bulkWrite(operations, { ordered: false });

  return {
    sourceUrl: AMFI_NAV_URL,
    processed: rows.length,
    upserted: toNumber(result.upsertedCount),
    modified: toNumber(result.modifiedCount),
    matched: toNumber(result.matchedCount),
  };
}

export async function importRiskLevels({ entries = [], overwrite = false, defaultSourceUrl = "", defaultSourceType = "OFFICIAL_IMPORT", defaultAsOfDate = null }) {
  const normalizedEntries = (entries || []).map((entry) => {
    const parsed = parseRiskImportEntry(entry);
    return {
      ...parsed,
      risk_source_url: parsed.risk_source_url || defaultSourceUrl,
      risk_source_type: parsed.risk_source_type || defaultSourceType,
      risk_as_of_date: parsed.risk_as_of_date || parseDate(defaultAsOfDate),
    };
  });

  if (!normalizedEntries.length) {
    throw new Error("No risk entries were provided.");
  }

  const now = new Date();
  const operations = normalizedEntries.map((entry) => {
    const setPayload = {
      risk_level: entry.risk_level,
      risk_source_type: entry.risk_source_type || defaultSourceType,
      risk_source_url: entry.risk_source_url || defaultSourceUrl,
      risk_as_of_date: entry.risk_as_of_date,
      risk_last_verified_at: now,
      risk_notes: entry.risk_notes || "",
    };

    if (entry.schema_name) {
      setPayload.schema_name = entry.schema_name;
    }

    const filter = overwrite
      ? { amfi_code: entry.amfi_code }
      : {
          amfi_code: entry.amfi_code,
          $or: [
            { risk_level: { $exists: false } },
            { risk_level: "" },
            { risk_level: null },
          ],
        };

    return {
      updateOne: {
        filter,
        update: {
          $set: setPayload,
          $setOnInsert: {
            amfi_code: entry.amfi_code,
            schema_name: entry.schema_name || "Unknown Scheme",
          },
        },
        upsert: true,
      },
    };
  });

  const result = await AMFIMaster.bulkWrite(operations, { ordered: false });
  const coverage = await getRiskMasterCoverage();

  return {
    processed: normalizedEntries.length,
    upserted: toNumber(result.upsertedCount),
    modified: toNumber(result.modifiedCount),
    matched: toNumber(result.matchedCount),
    coverage,
  };
}

export async function parseRiskImportFile(filePath) {
  const raw = await fs.readFile(filePath, "utf-8");
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      throw new Error("JSON risk import file must contain an array.");
    }
    return parsed;
  }

  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((acc, header, index) => {
      acc[header] = values[index] ?? "";
      return acc;
    }, {});
  });
}

export async function getRiskMasterCoverage() {
  const [totalSchemes, withRiskLevel] = await Promise.all([
    AMFIMaster.countDocuments(),
    AMFIMaster.countDocuments({
      risk_level: { $exists: true, $nin: [null, ""] },
    }),
  ]);

  return {
    totalSchemes,
    withRiskLevel,
    riskCoveragePct: totalSchemes > 0 ? Number(((withRiskLevel / totalSchemes) * 100).toFixed(1)) : 0,
  };
}
