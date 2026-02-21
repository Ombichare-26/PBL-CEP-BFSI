// services/recommendation/recommendation.js

import { inferPortfolioRisk } from "./riskInference.js";

export function analyzePortfolio({
  categoryPercentages,
  durationMonths,
  investmentAmount,
}) {
  const inferredRisk = inferPortfolioRisk({
    categoryPercentages,
    durationMonths,
    investmentAmount,
  });

  return {
    inferredRisk,
    inputs: {
      categoryPercentages,
      durationMonths,
      investmentAmount,
    },
  };
}