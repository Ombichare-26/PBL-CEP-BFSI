import { inferPortfolioRisk } from "./riskInference.js";
import { CATEGORY_FACTORS } from "./factorConfig.js";
import { FACTOR_WEIGHTS } from "./weights.js";
import { getDurationMultiplier } from "./durationAdjuster.js";
import { getAmountPenalty } from "./amountAdjuster.js";
import { evaluateDirectionWithAI } from "./aiDirectionEvaluator.js";

export async function analyzePortfolio({
  categoryPercentages,
  durationMonths,
  investmentAmount,
  expectedRoi,
  userSelectedDirection,
}) {
  // 1️⃣ Rule-based inference (authoritative)
  const inferredRisk = inferPortfolioRisk({
    categoryPercentages,
    durationMonths,
    investmentAmount,
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
  const aiEvaluation = await evaluateDirectionWithAI({
    userSelectedDirection,
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
  });

  return {
    inferredRisk,
    aiEvaluation,
    inputs: {
      categoryPercentages,
      durationMonths,
      investmentAmount,
      expectedRoi,
      userSelectedDirection,
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
