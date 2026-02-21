// services/recommendation/riskInference.js

import { CATEGORY_FACTORS } from "./factorConfig.js";
import { FACTOR_WEIGHTS } from "./weights.js";
import { getDurationMultiplier } from "./durationAdjuster.js";
import { getAmountPenalty } from "./amountAdjuster.js";

export function inferPortfolioRisk({
  categoryPercentages = {},
  durationMonths = 0,
  investmentAmount = 0,
}) {
  let score = 0;

  for (const category in categoryPercentages) {
    const rawPct = categoryPercentages[category];
    const percentage = Number(rawPct) / 100;

    if (isNaN(percentage)) continue;

    const factors = CATEGORY_FACTORS[category];
    if (!factors) continue;

    const baseScore =
      factors.risk * FACTOR_WEIGHTS.risk +
      factors.volatility * FACTOR_WEIGHTS.volatility +
      factors.stability * FACTOR_WEIGHTS.stability;

    score += baseScore * percentage;
  }

  const durationMultiplier = getDurationMultiplier(Number(durationMonths)) ?? 1;
  const amountPenalty = getAmountPenalty(Number(investmentAmount)) ?? 0;

  score *= durationMultiplier;
  score -= amountPenalty;

  // 🔒 Final safety guard
  if (isNaN(score)) {
    console.error("RISK SCORE IS NaN — CHECK INPUTS");
    return "CONSERVATIVE";
  }

  if (score >= 3.8) return "AGGRESSIVE";
if (score >= 2.6) return "BALANCED";
return "CONSERVATIVE";
}