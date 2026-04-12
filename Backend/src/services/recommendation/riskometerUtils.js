import AMFIMaster from "../../models/AMFI_Master_Fund.model.js";
import { lookupOfficialRiskometersWithGemini } from "./geminiRecommendation.service.js";

export const RISK_LABELS = [
  "LOW",
  "LOW_TO_MODERATE",
  "MODERATE",
  "MODERATELY_HIGH",
  "HIGH",
  "VERY_HIGH",
  "UNKNOWN",
];

export const RISK_LABEL_TO_SCORE = {
  LOW: 1,
  LOW_TO_MODERATE: 2,
  MODERATE: 3,
  MODERATELY_HIGH: 4,
  HIGH: 5,
  VERY_HIGH: 6,
  UNKNOWN: 0,
};

const SCORE_TO_RISK_LABEL = {
  1: "LOW",
  2: "LOW_TO_MODERATE",
  3: "MODERATE",
  4: "MODERATELY_HIGH",
  5: "HIGH",
  6: "VERY_HIGH",
};

const derivedHistoryRiskCache = new Map();
const geminiRiskCache = new Map();
const geminiRiskInFlight = new Map();
const RISK_HISTORY_WINDOW_DAYS = 365 * 5;
const GEMINI_RISK_CACHE_TTL_DAYS = Number(process.env.GEMINI_RISK_CACHE_TTL_DAYS) || 30;
const GEMINI_RISK_FAILURE_TTL_HOURS = Number(process.env.GEMINI_RISK_FAILURE_TTL_HOURS) || 24;
const GEMINI_RISK_BATCH_SIZE = Number(process.env.GEMINI_RISK_BATCH_SIZE) || 50;
const GEMINI_RISK_MIN_INTERVAL_MS = Number(process.env.GEMINI_RISK_MIN_INTERVAL_MS) || 4000;
let geminiRiskQueue = Promise.resolve();
let lastGeminiRiskLookupAt = 0;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enqueueGeminiRiskLookup(task) {
  const scheduled = geminiRiskQueue.then(async () => {
    const now = Date.now();
    const waitMs = Math.max(0, lastGeminiRiskLookupAt + GEMINI_RISK_MIN_INTERVAL_MS - now);
    if (waitMs > 0) {
      await wait(waitMs);
    }
    lastGeminiRiskLookupAt = Date.now();
    return task();
  });

  geminiRiskQueue = scheduled.catch(() => {});
  return scheduled;
}

function chunkArray(values = [], size = 1) {
  const normalizedSize = Math.max(1, Number(size) || 1);
  const chunks = [];
  for (let index = 0; index < values.length; index += normalizedSize) {
    chunks.push(values.slice(index, index + normalizedSize));
  }
  return chunks;
}

export function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isRecentDate(dateValue, ttlMs) {
  const value = dateValue ? new Date(dateValue) : null;
  if (!value || Number.isNaN(value.getTime())) return false;
  return (Date.now() - value.getTime()) <= ttlMs;
}

function isRecentSuccessfulGeminiCache(doc = {}) {
  return normalizeRiskLabel(doc?.risk_level) !== "UNKNOWN"
    && /^GEMINI_/.test(String(doc?.risk_source_type || ""))
    && isRecentDate(doc?.risk_last_verified_at || doc?.risk_as_of_date, GEMINI_RISK_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function isRecentFailedGeminiLookup(doc = {}) {
  return String(doc?.risk_source_type || "") === "GEMINI_LOOKUP_FAILED"
    && isRecentDate(doc?.risk_last_verified_at, GEMINI_RISK_FAILURE_TTL_HOURS * 60 * 60 * 1000);
}

export function normalizeRiskLabel(value) {
  const raw = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (!raw) return "UNKNOWN";
  if (raw === "LOW") return "LOW";
  if (raw === "LOW_TO_MODERATE") return "LOW_TO_MODERATE";
  if (raw === "MODERATE") return "MODERATE";
  if (raw === "MODERATELY_HIGH") return "MODERATELY_HIGH";
  if (raw === "HIGH") return "HIGH";
  if (raw === "VERY_HIGH") return "VERY_HIGH";
  return "UNKNOWN";
}

export function formatRiskLabel(label) {
  return String(normalizeRiskLabel(label)).replace(/_/g, " ");
}

export function getRiskScore(label) {
  return RISK_LABEL_TO_SCORE[normalizeRiskLabel(label)] || 0;
}

export function getRiskLabelFromScore(score) {
  const rounded = Math.min(6, Math.max(1, Math.round(toNumber(score))));
  return SCORE_TO_RISK_LABEL[rounded] || "UNKNOWN";
}

export function riskScoreToDirection(score) {
  const s = toNumber(score);
  if (s >= 4.4) return "AGGRESSIVE";
  if (s >= 2.8) return "BALANCED";
  return "CONSERVATIVE";
}

export function getGoalDirection({ durationMonths, expectedRoi }) {
  const months = toNumber(durationMonths);
  const roi = toNumber(expectedRoi);
  if (months >= 60 && roi >= 16) return "AGGRESSIVE";
  if (months >= 36 && roi >= 12) return "BALANCED";
  return "CONSERVATIVE";
}

export function clampDirectionByDuration(goalDirection, durationMonths) {
  const months = toNumber(durationMonths);
  if (months <= 12) return "CONSERVATIVE";
  if (months <= 24 && goalDirection === "AGGRESSIVE") return "BALANCED";
  return goalDirection;
}

export function getRoiFeasibility({ durationMonths, expectedRoi, recommendedDirection }) {
  const months = toNumber(durationMonths);
  const roi = toNumber(expectedRoi);
  const direction = String(recommendedDirection || "").toUpperCase();

  if (months < 12 && roi >= 12) return "UNREALISTIC";
  if (months < 24 && roi >= 15) return "UNREALISTIC";
  if (direction === "CONSERVATIVE" && roi >= 14) return "UNREALISTIC";
  if (direction === "BALANCED" && roi >= 18) return "STRETCH";
  if (direction === "AGGRESSIVE" && roi >= 22) return "STRETCH";
  return "REALISTIC";
}

export function normalizeDirection(value, fallback = "CONSERVATIVE") {
  const v = String(value || "").toUpperCase();
  if (v === "AGGRESSIVE" || v === "BALANCED" || v === "CONSERVATIVE") return v;
  return fallback;
}

export function normalizeDiversificationStatus(value, fallback = "WELL_DIVERSIFIED") {
  const v = String(value || "").toUpperCase();
  if (v === "WELL_DIVERSIFIED" || v === "OVERCONCENTRATED" || v === "PARTIALLY_VERIFIED") {
    return v;
  }
  return fallback;
}

export function buildCategoryExposure(holdings = []) {
  const totals = { ETF: 0, FLEXI: 0, SMALL: 0, OTHER: 0 };
  let grandTotal = 0;

  for (const holding of holdings) {
    const value = Math.max(0, toNumber(holding.current_value));
    const category = String(holding.category || "OTHER").toUpperCase();
    grandTotal += value;
    if (Object.hasOwn(totals, category)) totals[category] += value;
    else totals.OTHER += value;
  }

  const exposure = {};
  for (const [category, value] of Object.entries(totals)) {
    exposure[category] = grandTotal > 0 ? Number(((value / grandTotal) * 100).toFixed(1)) : 0;
  }
  return exposure;
}

export function buildRiskExposure(holdings = []) {
  const totals = Object.fromEntries(RISK_LABELS.map((label) => [label, 0]));
  let grandTotal = 0;

  for (const holding of holdings) {
    const value = Math.max(0, toNumber(holding.current_value));
    const label = normalizeRiskLabel(holding.riskLabel);
    grandTotal += value;
    totals[label] += value;
  }

  const exposure = {};
  for (const [label, value] of Object.entries(totals)) {
    exposure[label] = grandTotal > 0 ? Number(((value / grandTotal) * 100).toFixed(1)) : 0;
  }
  return exposure;
}

export function buildTopHoldings(holdings = [], limit = 3) {
  const sorted = [...holdings]
    .sort((a, b) => toNumber(b.current_value) - toNumber(a.current_value))
    .slice(0, limit);

  const grandTotal = holdings.reduce((sum, holding) => sum + Math.max(0, toNumber(holding.current_value)), 0);

  return sorted.map((holding) => ({
    schemeName: holding.scheme_name,
    amfiCode: holding.amfi_code || "",
    category: String(holding.category || "OTHER").toUpperCase(),
    riskLabel: normalizeRiskLabel(holding.riskLabel),
    currentValue: toNumber(holding.current_value),
    portfolioShare: grandTotal > 0 ? Number(((toNumber(holding.current_value) / grandTotal) * 100).toFixed(1)) : 0,
    riskSource: holding.riskSource || "UNAVAILABLE",
  }));
}

function parseMfApiDate(value) {
  const match = String(value || "").trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const parsed = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeCategoryRiskScore(category) {
  const value = String(category || "").trim().toUpperCase();
  if (!value) return 3;

  if (value === "SMALL" || /SMALL\s*CAP|MICRO\s*CAP/.test(value)) return 6;
  if (/MID\s*CAP|SECTORAL|THEMATIC|FOCUSED|INTERNATIONAL|COMMODITY/.test(value)) return 5;
  if (
    value === "ETF"
    || value === "FLEXI"
    || /FLEXI|MULTI\s*CAP|LARGE\s*CAP|ELSS|INDEX|ETF|VALUE|CONTRA/.test(value)
  ) {
    return 4;
  }
  if (/HYBRID|BALANCED|EQUITY\s*SAVINGS|ARBITRAGE|MULTI\s*ASSET/.test(value)) return 3;
  if (/GILT|CORPORATE\s*BOND|BANKING|PSU|SHORT\s*DURATION|MEDIUM\s*DURATION|DYNAMIC\s*BOND/.test(value)) return 2;
  if (/OVERNIGHT|LIQUID|MONEY\s*MARKET|ULTRA\s*SHORT/.test(value)) return 1;

  return value === "OTHER" ? 3 : 4;
}

function getVolatilityBucketScore(volatilityPct) {
  const value = Math.max(0, toNumber(volatilityPct));
  if (value <= 2) return 1;
  if (value <= 5) return 2;
  if (value <= 10) return 3;
  if (value <= 15) return 4;
  if (value <= 22) return 5;
  return 6;
}

function getDrawdownBucketScore(drawdownPct) {
  const value = Math.max(0, toNumber(drawdownPct));
  if (value <= 2) return 1;
  if (value <= 5) return 2;
  if (value <= 10) return 3;
  if (value <= 20) return 4;
  if (value <= 30) return 5;
  return 6;
}

function calculateAnnualizedVolatility(navPoints = []) {
  if (navPoints.length < 3) return null;

  const returns = [];
  for (let index = 1; index < navPoints.length; index += 1) {
    const previousNav = toNumber(navPoints[index - 1]?.nav);
    const currentNav = toNumber(navPoints[index]?.nav);
    if (previousNav <= 0 || currentNav <= 0) continue;
    returns.push((currentNav - previousNav) / previousNav);
  }

  if (returns.length < 2) return null;

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (returns.length - 1);
  const annualizedVolatilityPct = Math.sqrt(Math.max(variance, 0)) * Math.sqrt(252) * 100;
  return Number.isFinite(annualizedVolatilityPct) ? Number(annualizedVolatilityPct.toFixed(2)) : null;
}

function calculateMaxDrawdown(navPoints = []) {
  if (!navPoints.length) return null;

  let peak = toNumber(navPoints[0]?.nav);
  let maxDrawdown = 0;

  for (const point of navPoints) {
    const nav = toNumber(point?.nav);
    if (nav <= 0) continue;
    if (nav > peak) peak = nav;
    if (peak > 0) {
      maxDrawdown = Math.max(maxDrawdown, ((peak - nav) / peak) * 100);
    }
  }

  return Number(maxDrawdown.toFixed(2));
}

export function deriveRiskProfileFromMetrics({
  category = "",
  volatilityPct = null,
  maxDrawdownPct = null,
}) {
  const categoryScore = normalizeCategoryRiskScore(category);
  const volatilityScore = getVolatilityBucketScore(volatilityPct);
  const drawdownScore = getDrawdownBucketScore(maxDrawdownPct);

  let derivedScore = Math.round((categoryScore * 0.4) + (volatilityScore * 0.3) + (drawdownScore * 0.3));

  if (categoryScore >= 5 && (volatilityScore >= 5 || drawdownScore >= 5)) {
    derivedScore = Math.max(derivedScore, 5);
  }
  if (categoryScore <= 2 && volatilityScore <= 2 && drawdownScore <= 2) {
    derivedScore = Math.min(derivedScore, 2);
  }

  const boundedScore = Math.min(6, Math.max(1, derivedScore));
  return {
    categoryScore,
    volatilityScore,
    drawdownScore,
    derivedRiskScore: boundedScore,
    derivedRiskLabel: getRiskLabelFromScore(boundedScore),
  };
}

export async function fetchHistoricalRiskMetrics(amfiCode, { category = "" } = {}) {
  const code = String(amfiCode || "").trim();
  if (!code) return null;

  const cacheKey = `${code}:${String(category || "").trim().toUpperCase()}`;
  if (derivedHistoryRiskCache.has(cacheKey)) {
    return derivedHistoryRiskCache.get(cacheKey);
  }

  try {
    const response = await fetch(`https://api.mfapi.in/mf/${code}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Finercom/1.0)",
      },
    });

    if (!response.ok) {
      derivedHistoryRiskCache.set(cacheKey, null);
      return null;
    }

    const payload = await response.json();
    const history = Array.isArray(payload?.data) ? payload.data : [];
    const sortedHistory = history
      .map((entry) => ({
        nav: toNumber(entry?.nav, null),
        date: parseMfApiDate(entry?.date),
      }))
      .filter((entry) => entry.date && Number.isFinite(entry.nav) && entry.nav > 0)
      .sort((a, b) => a.date - b.date);

    if (sortedHistory.length < 3) {
      derivedHistoryRiskCache.set(cacheKey, null);
      return null;
    }

    const latestDate = sortedHistory[sortedHistory.length - 1]?.date || null;
    const windowStart = latestDate
      ? new Date(latestDate.getTime() - (RISK_HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000))
      : null;
    const riskWindowHistory = windowStart
      ? sortedHistory.filter((entry) => entry.date >= windowStart)
      : sortedHistory;

    if (riskWindowHistory.length < 3) {
      derivedHistoryRiskCache.set(cacheKey, null);
      return null;
    }

    const volatilityPct = calculateAnnualizedVolatility(riskWindowHistory);
    const maxDrawdownPct = calculateMaxDrawdown(riskWindowHistory);
    const effectiveCategory =
      category
      || payload?.meta?.scheme_category
      || payload?.meta?.scheme_type
      || "";

    const derived = deriveRiskProfileFromMetrics({
      category: effectiveCategory,
      volatilityPct,
      maxDrawdownPct,
    });

    const result = {
      category: effectiveCategory,
      volatilityPct,
      maxDrawdownPct,
      asOfDate: latestDate,
      windowStartDate: riskWindowHistory[0]?.date || null,
      calculatedAt: new Date(),
      sourceType: "DERIVED_HISTORY_MODEL",
      sourceUrl: `https://api.mfapi.in/mf/${code}`,
      ...derived,
      riskLevel: derived.derivedRiskLabel,
    };

    derivedHistoryRiskCache.set(cacheKey, result);
    return result;
  } catch {
    derivedHistoryRiskCache.set(cacheKey, null);
    return null;
  }
}

export async function fetchOfficialRiskometersWithGeminiBatch(funds = []) {
  const normalizedFunds = (Array.isArray(funds) ? funds : [])
    .map((fund) => ({
      amfiCode: String(fund?.amfiCode || fund?.amfi_code || "").trim(),
      schemeName: String(fund?.schemeName || fund?.scheme_name || "").trim(),
      fundHouse: String(fund?.fundHouse || fund?.fund_house || "").trim(),
      category: String(fund?.category || "").trim(),
    }))
    .filter((fund) => fund.schemeName);

  const resultMap = new Map();
  if (!process.env.GEMINI_API_KEY || !normalizedFunds.length) return resultMap;

  const uncachedFunds = [];
  for (const fund of normalizedFunds) {
    const cacheKey = `${fund.amfiCode}:${fund.schemeName}`.toUpperCase();
    if (geminiRiskCache.has(cacheKey)) {
      resultMap.set(cacheKey, geminiRiskCache.get(cacheKey));
      continue;
    }
    uncachedFunds.push({ ...fund, cacheKey });
  }

  for (const batch of chunkArray(uncachedFunds, GEMINI_RISK_BATCH_SIZE)) {
    const batchPromise = enqueueGeminiRiskLookup(async () => lookupOfficialRiskometersWithGemini(batch));

    for (const fund of batch) {
      geminiRiskInFlight.set(fund.cacheKey, batchPromise.then((lookups) => {
        const lookup = lookups[batch.findIndex((entry) => entry.cacheKey === fund.cacheKey)];
        if (lookup?.verified && normalizeRiskLabel(lookup.riskLabel) !== "UNKNOWN") {
          return {
            riskLabel: normalizeRiskLabel(lookup.riskLabel),
            rawRiskLabel: lookup.riskLabel,
            riskSource: lookup.sourceName ? `GEMINI_THIRD_PARTY_${lookup.sourceName}` : "GEMINI_LOOKUP",
            riskSourceUrl: lookup.sourceUrl || "",
            riskAsOfDate: null,
            riskAsOfDateText: lookup.asOfDateText || "",
            riskVerificationStatus: "THIRD_PARTY_FALLBACK",
            lookupStatus: lookup.lookupStatus || "FOUND",
          };
        }
        return {
          lookupStatus: lookup?.lookupStatus || "NOT_FOUND",
        };
      }));
    }

    try {
      const lookups = await batchPromise;
      batch.forEach((fund, index) => {
        const lookup = lookups[index];
        const normalized = lookup?.verified && normalizeRiskLabel(lookup.riskLabel) !== "UNKNOWN"
          ? {
              riskLabel: normalizeRiskLabel(lookup.riskLabel),
              rawRiskLabel: lookup.riskLabel,
              riskSource: lookup.sourceName ? `GEMINI_THIRD_PARTY_${lookup.sourceName}` : "GEMINI_LOOKUP",
              riskSourceUrl: lookup.sourceUrl || "",
              riskAsOfDate: null,
              riskAsOfDateText: lookup.asOfDateText || "",
              riskVerificationStatus: "THIRD_PARTY_FALLBACK",
              lookupStatus: lookup.lookupStatus || "FOUND",
            }
          : {
              lookupStatus: lookup?.lookupStatus || "NOT_FOUND",
            };

        if (normalized.lookupStatus !== "LOOKUP_ERROR") {
          geminiRiskCache.set(fund.cacheKey, normalized);
        }
        resultMap.set(fund.cacheKey, normalized);
      });
    } catch (error) {
      batch.forEach((fund) => {
        resultMap.set(fund.cacheKey, {
          lookupStatus: "LOOKUP_ERROR",
          lookupError: String(error?.message || error || ""),
        });
      });
    } finally {
      batch.forEach((fund) => {
        geminiRiskInFlight.delete(fund.cacheKey);
      });
    }
  }

  return resultMap;
}

async function cacheGeminiRiskometerResult({
  amfiCode = "",
  schemeName = "",
  category = "",
  fundHouse = "",
  risk = null,
} = {}) {
  const code = String(amfiCode || "").trim();
  if (!code || !risk || normalizeRiskLabel(risk.riskLabel) === "UNKNOWN") return;

  const setPayload = {
    risk_level: normalizeRiskLabel(risk.riskLabel),
    risk_source_type: risk.riskSource || "GEMINI_LOOKUP",
    risk_source_url: risk.riskSourceUrl || "",
    risk_last_verified_at: new Date(),
    risk_notes: risk.riskVerificationStatus || "",
  };

  if (risk.riskAsOfDateText) {
    setPayload.risk_notes = `${risk.riskVerificationStatus || ""} as of ${risk.riskAsOfDateText}`.trim();
  }
  if (schemeName) setPayload.schema_name = schemeName;
  if (category) setPayload.category = category;
  if (fundHouse) setPayload.fund_house = fundHouse;

  try {
    await AMFIMaster.updateOne(
      { amfi_code: code },
      {
        $set: setPayload,
        $setOnInsert: {
          amfi_code: code,
        },
      },
      { upsert: true }
    );
  } catch (error) {
    console.error("Failed to cache Gemini riskometer result", {
      amfiCode: code,
      schemeName,
      message: error?.message || String(error),
    });
  }
}

async function cacheGeminiRiskometerFailure({
  amfiCode = "",
  schemeName = "",
  category = "",
  fundHouse = "",
} = {}) {
  const code = String(amfiCode || "").trim();
  if (!code) return;

  try {
    await AMFIMaster.updateOne(
      { amfi_code: code },
      {
        $set: {
          risk_source_type: "GEMINI_LOOKUP_FAILED",
          risk_last_verified_at: new Date(),
          risk_notes: "UNVERIFIED",
          ...(schemeName ? { schema_name: schemeName } : {}),
          ...(category ? { category } : {}),
          ...(fundHouse ? { fund_house: fundHouse } : {}),
        },
        $setOnInsert: {
          amfi_code: code,
          ...(schemeName ? { schema_name: schemeName } : {}),
        },
      },
      { upsert: true }
    );
  } catch {
    // Failure caching is best-effort.
  }
}

export async function fetchSchemeRiskMap(amfiCodes = [], holdings = [], options = {}) {
  const allowGemini = options.allowGemini !== false;
  const uniqueCodes = [...new Set((amfiCodes || []).map((code) => String(code || "").trim()).filter(Boolean))];
  if (!uniqueCodes.length) return new Map();
  const holdingByCode = new Map(
    (holdings || [])
      .map((holding) => [String(holding?.amfi_code || "").trim(), holding])
      .filter(([code]) => Boolean(code))
  );

  const docs = await AMFIMaster.find(
    { amfi_code: { $in: uniqueCodes } },
    {
      amfi_code: 1,
      schema_name: 1,
      category: 1,
      risk_level: 1,
      fund_house: 1,
      risk_source_type: 1,
      risk_source_url: 1,
      risk_as_of_date: 1,
      risk_last_verified_at: 1,
    }
  ).lean();

  const map = new Map();
  const resolvedDocs = [];
  const docsNeedingGemini = [];
  for (const doc of docs) {
    const officialRiskLabel = normalizeRiskLabel(doc.risk_level);

    if (officialRiskLabel !== "UNKNOWN") {
      resolvedDocs.push({
        amfiCode: String(doc.amfi_code),
        schemeName: doc.schema_name || "",
        category: doc.category || "",
        fundHouse: doc.fund_house || "",
        riskLabel: officialRiskLabel,
        rawRiskLabel: doc.risk_level || "",
        riskSource: doc.risk_source_type || "AMFI_MASTER",
        riskSourceUrl: doc.risk_source_url || "",
        riskAsOfDate: doc.risk_as_of_date || doc.risk_last_verified_at || null,
      });
      continue;
    }

    if (isRecentFailedGeminiLookup(doc)) {
      const derived = await fetchHistoricalRiskMetrics(doc.amfi_code, { category: doc.category });
      resolvedDocs.push({
        amfiCode: String(doc.amfi_code),
        schemeName: doc.schema_name || "",
        category: doc.category || derived?.category || "",
        fundHouse: doc.fund_house || "",
        riskLabel: normalizeRiskLabel(derived?.riskLevel),
        rawRiskLabel: derived?.riskLevel || "",
        riskSource: derived?.sourceType || "UNAVAILABLE",
        riskSourceUrl: derived?.sourceUrl || "",
        riskAsOfDate: derived?.asOfDate || null,
        riskAsOfDateText: "",
        riskVerificationStatus: "DERIVED_ANALYTICS",
        derivedRiskScore: derived?.derivedRiskScore || 0,
        volatilityPct: derived?.volatilityPct ?? null,
        maxDrawdownPct: derived?.maxDrawdownPct ?? null,
      });
      continue;
    }

    if (allowGemini) {
      docsNeedingGemini.push(doc);
      continue;
    }

    const derived = await fetchHistoricalRiskMetrics(doc.amfi_code, { category: doc.category });
    resolvedDocs.push({
      amfiCode: String(doc.amfi_code),
      schemeName: doc.schema_name || "",
      category: doc.category || derived?.category || "",
      fundHouse: doc.fund_house || "",
      riskLabel: normalizeRiskLabel(derived?.riskLevel),
      rawRiskLabel: derived?.riskLevel || "",
      riskSource: derived?.sourceType || "UNAVAILABLE",
      riskSourceUrl: derived?.sourceUrl || "",
      riskAsOfDate: derived?.asOfDate || null,
      riskAsOfDateText: "",
      riskVerificationStatus: "DERIVED_ANALYTICS",
      derivedRiskScore: derived?.derivedRiskScore || 0,
      volatilityPct: derived?.volatilityPct ?? null,
      maxDrawdownPct: derived?.maxDrawdownPct ?? null,
    });
  }

  if (allowGemini && docsNeedingGemini.length) {
    const geminiResults = await lookupOfficialRiskometersWithGemini(
      docsNeedingGemini.map((doc) => ({
        schemeName: doc.schema_name,
        amfiCode: doc.amfi_code,
        fundHouse: doc.fund_house,
        category: doc.category,
      }))
    );

    for (const [index, doc] of docsNeedingGemini.entries()) {
      const lookup = geminiResults[index];
      const geminiOfficialRisk = lookup?.verified && normalizeRiskLabel(lookup?.riskLabel) !== "UNKNOWN"
        ? {
            riskLabel: normalizeRiskLabel(lookup.riskLabel),
            rawRiskLabel: lookup.riskLabel,
            riskSource: lookup.sourceName ? `GEMINI_THIRD_PARTY_${lookup.sourceName}` : "GEMINI_LOOKUP",
            riskSourceUrl: lookup.sourceUrl || "",
            riskAsOfDate: null,
            riskAsOfDateText: lookup.asOfDateText || "",
            riskVerificationStatus: "THIRD_PARTY_FALLBACK",
            lookupStatus: lookup.lookupStatus || "FOUND",
          }
        : null;

      if (geminiOfficialRisk?.riskLabel) {
        await cacheGeminiRiskometerResult({
          amfiCode: doc.amfi_code,
          schemeName: doc.schema_name || "",
          fundHouse: doc.fund_house || "",
          category: doc.category || "",
          risk: geminiOfficialRisk,
        });

        resolvedDocs.push({
          amfiCode: String(doc.amfi_code),
          schemeName: doc.schema_name || "",
          category: doc.category || "",
          fundHouse: doc.fund_house || "",
          ...geminiOfficialRisk,
        });
        continue;
      }

      if (lookup?.lookupStatus !== "LOOKUP_ERROR") {
        await cacheGeminiRiskometerFailure({
          amfiCode: doc.amfi_code,
          schemeName: doc.schema_name || "",
          fundHouse: doc.fund_house || "",
          category: doc.category || "",
        });
      }

      const derived = await fetchHistoricalRiskMetrics(doc.amfi_code, { category: doc.category });
      resolvedDocs.push({
        amfiCode: String(doc.amfi_code),
        schemeName: doc.schema_name || "",
        category: doc.category || derived?.category || "",
        fundHouse: doc.fund_house || "",
        riskLabel: normalizeRiskLabel(derived?.riskLevel),
        rawRiskLabel: derived?.riskLevel || "",
        riskSource: derived?.sourceType || "UNAVAILABLE",
        riskSourceUrl: derived?.sourceUrl || "",
        riskAsOfDate: derived?.asOfDate || null,
        riskAsOfDateText: "",
        riskVerificationStatus: "DERIVED_ANALYTICS",
        derivedRiskScore: derived?.derivedRiskScore || 0,
        volatilityPct: derived?.volatilityPct ?? null,
        maxDrawdownPct: derived?.maxDrawdownPct ?? null,
      });
    }
  }

  for (const entry of resolvedDocs) {
    map.set(entry.amfiCode, {
      schemeName: entry.schemeName,
      category: entry.category,
      fundHouse: entry.fundHouse,
      riskLabel: entry.riskLabel,
      rawRiskLabel: entry.rawRiskLabel,
      riskSource: entry.riskSource,
      riskSourceUrl: entry.riskSourceUrl,
      riskAsOfDate: entry.riskAsOfDate,
      riskAsOfDateText: entry.riskAsOfDateText || "",
      riskVerificationStatus: entry.riskVerificationStatus || "",
      derivedRiskScore: entry.derivedRiskScore || 0,
      volatilityPct: entry.volatilityPct ?? null,
      maxDrawdownPct: entry.maxDrawdownPct ?? null,
    });
  }

  const unresolvedCodes = uniqueCodes.filter((code) => !map.has(code));
  if (unresolvedCodes.length) {
    const unresolvedNeedingGemini = [];
    for (const code of unresolvedCodes) {
      const holding = holdingByCode.get(code);
      if (allowGemini) {
        unresolvedNeedingGemini.push({ code, holding });
        continue;
      }

      const derived = await fetchHistoricalRiskMetrics(code, {
        category: holding?.masterCategory || holding?.category || "",
      });

      map.set(code, {
        schemeName: holding?.scheme_name || holding?.schemeName || "",
        category: holding?.masterCategory || holding?.category || derived?.category || "",
        fundHouse: "",
        riskLabel: normalizeRiskLabel(derived?.riskLevel),
        rawRiskLabel: derived?.riskLevel || "",
        riskSource: derived?.sourceType || "UNAVAILABLE",
        riskSourceUrl: derived?.sourceUrl || "",
        riskAsOfDate: derived?.asOfDate || null,
        riskAsOfDateText: "",
        riskVerificationStatus: "DERIVED_ANALYTICS",
        derivedRiskScore: derived?.derivedRiskScore || 0,
        volatilityPct: derived?.volatilityPct ?? null,
        maxDrawdownPct: derived?.maxDrawdownPct ?? null,
      });
    }

    if (allowGemini && unresolvedNeedingGemini.length) {
      const geminiResults = await lookupOfficialRiskometersWithGemini(
        unresolvedNeedingGemini.map(({ code, holding }) => ({
          schemeName: holding?.scheme_name || holding?.schemeName || "",
          amfiCode: code,
          fundHouse: holding?.fund_house || holding?.fundHouse || "",
          category: holding?.masterCategory || holding?.category || "",
        }))
      );

      for (const [index, unresolved] of unresolvedNeedingGemini.entries()) {
        const { code, holding } = unresolved;
        const schemeName = holding?.scheme_name || holding?.schemeName || "";
        const lookup = geminiResults[index];
        const geminiOfficialRisk = lookup?.verified && normalizeRiskLabel(lookup?.riskLabel) !== "UNKNOWN"
          ? {
              riskLabel: normalizeRiskLabel(lookup.riskLabel),
              rawRiskLabel: lookup.riskLabel,
              riskSource: lookup.sourceName ? `GEMINI_THIRD_PARTY_${lookup.sourceName}` : "GEMINI_LOOKUP",
              riskSourceUrl: lookup.sourceUrl || "",
              riskAsOfDate: null,
              riskAsOfDateText: lookup.asOfDateText || "",
              riskVerificationStatus: "THIRD_PARTY_FALLBACK",
              lookupStatus: lookup.lookupStatus || "FOUND",
            }
          : null;

        if (geminiOfficialRisk?.riskLabel) {
          await cacheGeminiRiskometerResult({
            amfiCode: code,
            schemeName,
            fundHouse: holding?.fund_house || holding?.fundHouse || "",
            category: holding?.masterCategory || holding?.category || "",
            risk: geminiOfficialRisk,
          });

          map.set(code, {
            schemeName,
            category: holding?.masterCategory || holding?.category || "",
            fundHouse: holding?.fund_house || holding?.fundHouse || "",
            ...geminiOfficialRisk,
            derivedRiskScore: 0,
            volatilityPct: null,
            maxDrawdownPct: null,
          });
          continue;
        }

        if (lookup?.lookupStatus !== "LOOKUP_ERROR") {
          await cacheGeminiRiskometerFailure({
            amfiCode: code,
            schemeName,
            fundHouse: holding?.fund_house || holding?.fundHouse || "",
            category: holding?.masterCategory || holding?.category || "",
          });
        }

        const derived = await fetchHistoricalRiskMetrics(code, {
          category: holding?.masterCategory || holding?.category || "",
        });

        map.set(code, {
          schemeName,
          category: holding?.masterCategory || holding?.category || derived?.category || "",
          fundHouse: "",
          riskLabel: normalizeRiskLabel(derived?.riskLevel),
          rawRiskLabel: derived?.riskLevel || "",
          riskSource: derived?.sourceType || "UNAVAILABLE",
          riskSourceUrl: derived?.sourceUrl || "",
          riskAsOfDate: derived?.asOfDate || null,
          riskAsOfDateText: "",
          riskVerificationStatus: "DERIVED_ANALYTICS",
          derivedRiskScore: derived?.derivedRiskScore || 0,
          volatilityPct: derived?.volatilityPct ?? null,
          maxDrawdownPct: derived?.maxDrawdownPct ?? null,
        });
      }
    }
  }

  return map;
}

export function buildHoldingRiskSnapshot(holdings = [], schemeRiskMap = new Map()) {
  return holdings.map((holding) => {
    const code = String(holding.amfi_code || "").trim();
    const schemeRisk = code ? schemeRiskMap.get(code) : null;
    const portfolioRiskLabel = normalizeRiskLabel(holding.risk_level || holding.riskLabel);
    const riskLabel = normalizeRiskLabel(schemeRisk?.riskLabel || portfolioRiskLabel);
    const riskSource = schemeRisk?.riskSource
      || (portfolioRiskLabel !== "UNKNOWN" ? String(holding.risk_source_type || "PORTFOLIO_IMPORT").toUpperCase() : "UNAVAILABLE");

    return {
      ...holding,
      amfi_code: code,
      category: String(holding.category || "OTHER").toUpperCase(),
      masterCategory: schemeRisk?.category || "",
      current_value: Math.max(0, toNumber(holding.current_value)),
      units: toNumber(holding.units),
      riskLabel,
      rawRiskLabel: schemeRisk?.rawRiskLabel || holding.risk_level || holding.riskLabel || "",
      riskSource,
      riskSourceUrl: schemeRisk?.riskSourceUrl || holding.risk_source_url || "",
      riskAsOfDate: schemeRisk?.riskAsOfDate || holding.risk_as_of_date || null,
      riskAsOfDateText: schemeRisk?.riskAsOfDateText || "",
      riskVerificationStatus: schemeRisk?.riskVerificationStatus || "",
      derivedRiskScore: toNumber(schemeRisk?.derivedRiskScore),
      volatilityPct: schemeRisk?.volatilityPct ?? null,
      maxDrawdownPct: schemeRisk?.maxDrawdownPct ?? null,
      schemeReferenceName: schemeRisk?.schemeName || holding.scheme_name || "",
    };
  });
}

export function buildCoverageStats(holdings = []) {
  const totalValue = holdings.reduce((sum, holding) => sum + Math.max(0, toNumber(holding.current_value)), 0);
  const verifiedHoldings = holdings.filter((holding) => normalizeRiskLabel(holding.riskLabel) !== "UNKNOWN");
  const verifiedValue = verifiedHoldings.reduce((sum, holding) => sum + Math.max(0, toNumber(holding.current_value)), 0);

  return {
    totalValue: Number(totalValue.toFixed(2)),
    verifiedValue: Number(verifiedValue.toFixed(2)),
    verifiedFunds: verifiedHoldings.length,
    totalFunds: holdings.length,
    officialCoverageByValuePct: totalValue > 0 ? Number(((verifiedValue / totalValue) * 100).toFixed(1)) : 0,
    officialCoverageBySchemePct: holdings.length > 0 ? Number(((verifiedHoldings.length / holdings.length) * 100).toFixed(1)) : 0,
  };
}
