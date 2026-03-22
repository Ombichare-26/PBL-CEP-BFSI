// services/recommendation/riskInference.js

import { CATEGORY_FACTORS } from "./factorConfig.js";
import { FACTOR_WEIGHTS } from "./weights.js";
import { getDurationMultiplier } from "./durationAdjuster.js";
import { getAmountPenalty } from "./amountAdjuster.js";

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeCategoryPercentages(categoryPercentages = {}) {
  const normalized = {};
  for (const [rawKey, rawValue] of Object.entries(categoryPercentages || {})) {
    const key = String(rawKey || "").toUpperCase().trim();
    if (!key) continue;
    const value = Math.max(0, Math.min(100, toFiniteNumber(rawValue, 0)));
    normalized[key] = value;
  }
  return normalized;
}

function normalizeFactorWeights(weights = {}) {
  const risk = toFiniteNumber(weights.risk, 0);
  const volatility = toFiniteNumber(weights.volatility, 0);
  const stability = toFiniteNumber(weights.stability, 0);
  const sum = risk + volatility + stability;
  if (sum <= 0) return { risk: 0.4, volatility: 0.35, stability: 0.25 };
  return {
    risk: risk / sum,
    volatility: volatility / sum,
    stability: stability / sum,
  };
}

export function classifyRiskFromScore(score) {
  const s = toFiniteNumber(score, 0);
  if (s >= 3.8) return "AGGRESSIVE";
  if (s >= 2.6) return "BALANCED";
  return "CONSERVATIVE";
}

export function computeRiskScoreDetails({
  categoryPercentages = {},
  durationMonths = 0,
  investmentAmount = 0,
}) {
  const normalizedCategoryPercentages = normalizeCategoryPercentages(categoryPercentages);
  const weights = normalizeFactorWeights(FACTOR_WEIGHTS);

  let rawScore = 0;
  const contributions = [];
  const ignoredCategories = [];

  for (const [category, pctVal] of Object.entries(normalizedCategoryPercentages)) {
    const factors = CATEGORY_FACTORS[category];
    if (!factors) {
      ignoredCategories.push(category);
      continue;
    }

    const percentage = pctVal / 100;
    const weightedBase =
      factors.risk * weights.risk +
      factors.volatility * weights.volatility +
      factors.stability * weights.stability;

    const contribution = weightedBase * percentage;
    rawScore += contribution;

    contributions.push({
      category,
      percentage: pctVal,
      factors,
      weightedBase: Number(weightedBase.toFixed(3)),
      contribution: Number(contribution.toFixed(3)),
    });
  }

  const durationMultiplier = getDurationMultiplier(toFiniteNumber(durationMonths)) ?? 1;
  const amountPenalty = getAmountPenalty(toFiniteNumber(investmentAmount)) ?? 0;
  const finalScore = Number((rawScore * durationMultiplier - amountPenalty).toFixed(3));

  return {
    factorWeights: weights,
    categoryFactors: CATEGORY_FACTORS,
    normalizedCategoryPercentages,
    rawScore: Number(rawScore.toFixed(3)),
    durationMultiplier: Number(toFiniteNumber(durationMultiplier, 1).toFixed(3)),
    amountPenalty: Number(toFiniteNumber(amountPenalty, 0).toFixed(3)),
    finalScore,
    contributions,
    ignoredCategories,
  };
}

export function inferPortfolioRisk({
  categoryPercentages = {},
  durationMonths = 0,
  investmentAmount = 0,
}) {
  const details = computeRiskScoreDetails({
    categoryPercentages,
    durationMonths,
    investmentAmount,
  });

  // 🔒 Final safety guard
  if (isNaN(details.finalScore)) {
    console.error("RISK SCORE IS NaN — CHECK INPUTS");
    return "CONSERVATIVE";
  }

  return classifyRiskFromScore(details.finalScore);
}
