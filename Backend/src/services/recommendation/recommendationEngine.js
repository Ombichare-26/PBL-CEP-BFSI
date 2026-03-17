import { inferPortfolioRisk } from "./riskInference.js";
import { CATEGORY_FACTORS } from "./factorConfig.js";
import { FACTOR_WEIGHTS } from "./weights.js";
import { getDurationMultiplier } from "./durationAdjuster.js";
import { getAmountPenalty } from "./amountAdjuster.js";
import { evaluateDirectionWithAI } from "./aiDirectionEvaluator.js";

function clampDirectionByDuration(goalDirection, durationMonths) {
  const months = Number(durationMonths) || 0;
  if (months <= 12) return "CONSERVATIVE";
  if (months <= 24 && goalDirection === "AGGRESSIVE") return "BALANCED";
  return goalDirection;
}

function getGoalDirection({ durationMonths, expectedRoi }) {
  const months = Number(durationMonths) || 0;
  const roi = Number(expectedRoi) || 0;
  if (months >= 60 && roi >= 16) return "AGGRESSIVE";
  if (months >= 36 && roi >= 12) return "BALANCED";
  return "CONSERVATIVE";
}

function getRoiFeasibility({ durationMonths, expectedRoi, recommendedDirection }) {
  const months = Number(durationMonths) || 0;
  const roi = Number(expectedRoi) || 0;
  const direction = String(recommendedDirection || "").toUpperCase();

  if (months < 12 && roi >= 12) return "UNREALISTIC";
  if (months < 24 && roi >= 15) return "UNREALISTIC";
  if (direction === "CONSERVATIVE" && roi >= 14) return "UNREALISTIC";
  if (direction === "BALANCED" && roi >= 18) return "STRETCH";
  if (direction === "AGGRESSIVE" && roi >= 22) return "STRETCH";
  return "REALISTIC";
}

function getRecommendedDirection({ currentRisk, durationMonths, expectedRoi }) {
  const goalDirection = clampDirectionByDuration(
    getGoalDirection({ durationMonths, expectedRoi }),
    durationMonths
  );

  const current = String(currentRisk || "").toUpperCase();
  if (current === "CONSERVATIVE") return goalDirection === "AGGRESSIVE" ? "BALANCED" : goalDirection;
  if (current === "BALANCED") return goalDirection;
  if (current === "AGGRESSIVE") {
    const months = Number(durationMonths) || 0;
    if (months <= 24) return "BALANCED";
    return goalDirection;
  }
  return goalDirection;
}

function buildTargetAllocation({
  recommendedDirection,
  durationMonths,
  expectedRoi,
  investmentAmount,
}) {
  const direction = String(recommendedDirection || "").toUpperCase();
  const months = Number(durationMonths) || 0;
  const roi = Number(expectedRoi) || 0;
  const amount = Number(investmentAmount) || 0;

  const base =
    direction === "AGGRESSIVE"
      ? { ETF: 30, FLEXI: 40, SMALL: 30 }
      : direction === "BALANCED"
        ? { ETF: 50, FLEXI: 40, SMALL: 10 }
        : { ETF: 75, FLEXI: 25, SMALL: 0 };

  const maxSmall =
    months <= 12 ? 0 : months <= 24 ? 5 : months <= 36 ? 10 : months <= 60 ? 20 : 30;
  const minSmall =
    direction === "AGGRESSIVE"
      ? Math.min(15, maxSmall)
      : direction === "BALANCED"
        ? Math.min(5, maxSmall)
        : 0;

  let desiredSmall = minSmall;
  if (roi >= 18) desiredSmall = maxSmall;
  else if (roi >= 15) desiredSmall = Math.min(maxSmall, Math.max(minSmall, 15));
  else if (roi >= 12) desiredSmall = Math.min(maxSmall, Math.max(minSmall, 10));

  const minFlexi = direction === "CONSERVATIVE" ? 15 : 20;

  let desiredEtf = base.ETF;
  if (months <= 12) desiredEtf = 90;
  else if (months <= 24) desiredEtf = Math.max(desiredEtf, 70);
  else if (months <= 36) desiredEtf = Math.max(desiredEtf, 55);

  if (amount >= 500000) desiredEtf = Math.min(90, desiredEtf + 5);

  const remainingAfterSmall = 100 - desiredSmall;
  desiredEtf = Math.min(desiredEtf, remainingAfterSmall - minFlexi);
  desiredEtf = Math.max(25, Math.min(95, desiredEtf));

  let desiredFlexi = remainingAfterSmall - desiredEtf;
  if (desiredFlexi < minFlexi) {
    desiredFlexi = minFlexi;
    desiredEtf = remainingAfterSmall - desiredFlexi;
  }

  const etf = Number(desiredEtf.toFixed(0));
  const flexi = Number(desiredFlexi.toFixed(0));
  const small = 100 - etf - flexi;

  return { ETF: etf, FLEXI: flexi, SMALL: small };
}

function buildAllocationDiff({ currentAllocation, targetAllocation }) {
  const diff = {};
  const keys = new Set([
    ...Object.keys(currentAllocation || {}),
    ...Object.keys(targetAllocation || {}),
  ]);
  for (const k of keys) {
    const current = Number(currentAllocation?.[k]) || 0;
    const target = Number(targetAllocation?.[k]) || 0;
    diff[k] = Number((target - current).toFixed(0));
  }
  return diff;
}

function getDiversificationNotes(categoryPercentages) {
  const notes = [];
  const entries = Object.entries(categoryPercentages || {}).map(([k, v]) => [
    String(k).toUpperCase(),
    Number(v) || 0,
  ]);

  for (const [k, v] of entries) {
    if (v >= 70) notes.push(`${k}_OVER_70`);
    if (v > 0 && v < 5) notes.push(`${k}_UNDER_5`);
  }
  return notes;
}

function getDiversificationStatus(diversificationNotes) {
  const notes = diversificationNotes || [];
  if (notes.some((n) => String(n).includes("_OVER_70"))) return "OVERCONCENTRATED";
  if (notes.some((n) => String(n).includes("_UNDER_5"))) return "UNDEREXPOSED";
  return "WELL_DIVERSIFIED";
}

export async function analyzePortfolio({
  categoryPercentages,
  durationMonths,
  investmentAmount,
  expectedRoi,
}) {
  // 1️⃣ Rule-based inference (authoritative)
  const inferredRisk = inferPortfolioRisk({
    categoryPercentages,
    durationMonths,
    investmentAmount,
  });

  const recommendedDirection = getRecommendedDirection({
    currentRisk: inferredRisk,
    durationMonths,
    expectedRoi,
  });

  // Build structured factor breakdown for transparency to LLM
  const breakdown = [];
  let rawScore = 0;
  for (const [category, pctVal] of Object.entries(categoryPercentages || {})) {
    const factors = CATEGORY_FACTORS[category];
    if (!factors) continue;
    const pct = Number(pctVal) / 100;
    const weightedBase =
      factors.risk * FACTOR_WEIGHTS.risk +
      factors.volatility * FACTOR_WEIGHTS.volatility +
      factors.stability * FACTOR_WEIGHTS.stability;
    const contribution = weightedBase * (isNaN(pct) ? 0 : pct);
    rawScore += contribution;
    breakdown.push({
      category,
      percentage: Number(pctVal) || 0,
      factors,
      weightedBase: Number(weightedBase.toFixed(3)),
      contribution: Number(contribution.toFixed(3)),
    });
  }
  const durationMultiplier = getDurationMultiplier(Number(durationMonths)) ?? 1;
  const amountPenalty = getAmountPenalty(Number(investmentAmount)) ?? 0;
  const finalScore = Number((rawScore * durationMultiplier - amountPenalty).toFixed(3));

  // 2️⃣ AI evaluation (judgment + explanation)
  const targetAllocation = buildTargetAllocation({
    recommendedDirection,
    durationMonths,
    expectedRoi,
    investmentAmount,
  });
  const allocationDiff = buildAllocationDiff({
    currentAllocation: categoryPercentages,
    targetAllocation,
  });
  const diversificationNotes = getDiversificationNotes(categoryPercentages);
  const diversificationStatus = getDiversificationStatus(diversificationNotes);
  const goalDirection = clampDirectionByDuration(
    getGoalDirection({ durationMonths, expectedRoi }),
    durationMonths
  );
  const roiFeasibility = getRoiFeasibility({
    durationMonths,
    expectedRoi,
    recommendedDirection,
  });

  const aiEvaluation = await evaluateDirectionWithAI({
    categoryPercentages,
    inferredRisk,
    durationMonths,
    investmentAmount,
    expectedRoi,
    structuredFactors: {
      factorWeights: FACTOR_WEIGHTS,
      categoryFactors: CATEGORY_FACTORS,
      rawScore: Number(rawScore.toFixed(3)),
      durationMultiplier,
      amountPenalty,
      finalScore,
      contributions: breakdown,
    },
    recommendationContext: {
      recommendedDirection,
      goalDirection,
      roiFeasibility,
      targetAllocation,
      allocationDiff,
      diversificationNotes,
      diversificationStatus,
    },
  });

  return {
    inferredRisk,
    recommendedDirection,
    aiEvaluation,
    inputs: {
      categoryPercentages,
      durationMonths,
      investmentAmount,
      expectedRoi,
    },
    factors: {
      factorWeights: FACTOR_WEIGHTS,
      rawScore: Number(rawScore.toFixed(3)),
      durationMultiplier,
      amountPenalty,
      finalScore,
      contributions: breakdown,
    },
  };
}
