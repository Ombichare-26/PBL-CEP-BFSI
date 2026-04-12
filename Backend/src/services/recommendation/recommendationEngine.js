import {
  buildCategoryExposure,
  buildCoverageStats,
  buildHoldingRiskSnapshot,
  buildRiskExposure,
  buildTopHoldings,
  clampDirectionByDuration,
  fetchSchemeRiskMap,
  formatRiskLabel,
  getGoalDirection,
  getRiskScore,
  getRoiFeasibility,
  normalizeRiskLabel,
  riskScoreToDirection,
  toNumber,
} from "./riskometerUtils.js";
import {
  buildRiskProfileNarrative,
  generateInitialRecommendationWithGemini,
} from "./geminiRecommendation.service.js";

const FOCUSED_CATEGORIES = new Set(["ETF", "FLEXI", "SMALL"]);

function getDiversificationStatus({ topHoldingShare, topCategoryShare, coverageByValuePct }) {
  if (topHoldingShare >= 35 || topCategoryShare >= 70) return "OVERCONCENTRATED";
  if (coverageByValuePct < 70) return "PARTIALLY_VERIFIED";
  return "WELL_DIVERSIFIED";
}

function getDominantRiskLevel(schemeRiskExposure = {}) {
  return Object.entries(schemeRiskExposure)
    .filter(([label]) => label !== "UNKNOWN")
    .sort((a, b) => toNumber(b[1]) - toNumber(a[1]))[0]?.[0] || "UNKNOWN";
}

function getWeightedRiskScore(holdings = []) {
  const verified = holdings.filter((holding) => getRiskScore(holding.riskLabel) > 0);
  const verifiedValue = verified.reduce((sum, holding) => sum + toNumber(holding.current_value), 0);
  if (!verifiedValue) return 0;

  const weighted = verified.reduce((sum, holding) => {
    return sum + toNumber(holding.current_value) * getRiskScore(holding.riskLabel);
  }, 0);

  return Number((weighted / verifiedValue).toFixed(3));
}

function getRecommendedDirection({ weightedRiskScore, durationMonths, expectedRoi }) {
  const currentRisk = riskScoreToDirection(weightedRiskScore);
  const goalDirection = clampDirectionByDuration(
    getGoalDirection({ durationMonths, expectedRoi }),
    durationMonths
  );

  if (currentRisk === "CONSERVATIVE") {
    return goalDirection === "AGGRESSIVE" ? "BALANCED" : goalDirection;
  }

  if (currentRisk === "BALANCED") {
    return goalDirection;
  }

  if (currentRisk === "AGGRESSIVE") {
    const months = toNumber(durationMonths);
    if (months <= 24) return "BALANCED";
    return goalDirection;
  }

  return goalDirection;
}

function buildConcentrationFlags({ topHoldings, categoryExposure, riskExposure, coverageByValuePct }) {
  const flags = [];
  const topHolding = topHoldings[0];
  const topThreeShare = topHoldings.reduce((sum, holding) => sum + toNumber(holding.portfolioShare), 0);
  const topCategory = Object.entries(categoryExposure).sort((a, b) => toNumber(b[1]) - toNumber(a[1]))[0];

  if (topHolding && topHolding.portfolioShare >= 35) {
    flags.push(`Single scheme concentration is high at ${Math.round(topHolding.portfolioShare)}% in ${topHolding.schemeName}.`);
  }
  if (topThreeShare >= 70) {
    flags.push(`Top 3 holdings account for ${Math.round(topThreeShare)}% of the portfolio.`);
  }
  if (topCategory && toNumber(topCategory[1]) >= 70) {
    flags.push(`${topCategory[0]} dominates the portfolio at ${Math.round(topCategory[1])}% of current value.`);
  }
  if (toNumber(riskExposure.VERY_HIGH) >= 50) {
    flags.push(`Very High risk schemes account for ${Math.round(riskExposure.VERY_HIGH)}% of current value.`);
  }
  if (coverageByValuePct < 70) {
    flags.push(`Only ${Math.round(coverageByValuePct)}% of portfolio value is currently verified against stored scheme risk labels.`);
  }

  return flags;
}

function buildAdviceForNewInvestment({
  recommendedDirection,
  durationMonths,
  categoryExposure,
  riskExposure,
  topHoldings,
  diversificationStatus,
  coverageByValuePct,
}) {
  const advice = [];
  const topHolding = topHoldings[0];
  const shortHorizon = toNumber(durationMonths) <= 24;

  if (coverageByValuePct < 70) {
    advice.push("Part of the portfolio is unverified; confirm missing risk labels.");
  }

  if (diversificationStatus === "OVERCONCENTRATED" && topHolding?.portfolioShare >= 35) {
    advice.push(`Reduce concentration in ${topHolding.schemeName} by directing fresh money elsewhere.`);
  }

  if (toNumber(riskExposure.VERY_HIGH) >= 50 && shortHorizon) {
    advice.push("Prefer lower-volatility schemes for new investments due to the short horizon.");
  }

  if (toNumber(categoryExposure.SMALL) >= 25) {
    advice.push("Limit further Small Cap exposure as it is already a significant slice of your portfolio.");
  }

  if (recommendedDirection === "CONSERVATIVE") {
    advice.push("Focus new investments on stability-first funds.");
  }

  if (!advice.length) {
    advice.push("Direct fresh capital toward the best-diversified parts of the portfolio.");
  }

  return advice.slice(0, 3);
}

function buildImprovementSteps({ adviceForNewInvestment, topHoldings, diversificationStatus }) {
  const steps = [];
  if (diversificationStatus === "OVERCONCENTRATED" && topHoldings[0]) {
    steps.push(`Consider pausing contributions to ${topHoldings[0].schemeName}.`);
  }
  if (adviceForNewInvestment.length > 0) {
    steps.push(adviceForNewInvestment[0]);
  }
  return [...new Set(steps)].slice(0, 2);
}

function buildNewInvestmentPlan({
  recommendedDirection,
  currentAllocation,
  durationMonths,
  diversificationStatus,
  topHoldings,
  riskExposure,
  weightedRiskScore,
}) {
  const dominantCategory = Object.entries(currentAllocation || {})
    .sort((a, b) => toNumber(b[1]) - toNumber(a[1]))[0]?.[0] || "OTHER";
  const dominantCategoryShare = toNumber(currentAllocation?.[dominantCategory]);
  const topHolding = topHoldings?.[0];
  const isOverconcentrated = diversificationStatus === "OVERCONCENTRATED";
  const isHighRiskPortfolio = toNumber(weightedRiskScore) >= 4.5 || toNumber(riskExposure?.HIGH) + toNumber(riskExposure?.VERY_HIGH) >= 60;
  const longHorizon = toNumber(durationMonths) >= 60;
  const mediumHorizon = toNumber(durationMonths) >= 36;

  const categories = [];

  const addPlan = (category, priority, guidance, reason) => {
    categories.push({ category, priority, guidance, reason });
  };

  if (dominantCategory !== "ETF" && (isOverconcentrated || isHighRiskPortfolio || toNumber(currentAllocation?.ETF) < 20)) {
    addPlan(
      "ETF",
      "HIGH",
      "Use ETF or broad-market exposure as the main destination for fresh money.",
      "It helps reduce single-scheme concentration and lowers portfolio-level volatility compared with adding more to the current dominant holding."
    );
  } else {
    addPlan(
      "ETF",
      "MEDIUM",
      "Keep ETF as a stabilizing bucket when adding new money.",
      "It improves diversification quality without forcing the portfolio further into one active bet."
    );
  }

  if (dominantCategory === "FLEXI" && dominantCategoryShare >= 60) {
    addPlan(
      "FLEXI",
      "LOW",
      "Do not make Flexi Cap the main destination for fresh money right now.",
      `The portfolio is already heavily concentrated in ${topHolding?.schemeName || "the existing Flexi allocation"}, so adding more here would reinforce concentration instead of improving balance.`
    );
  } else if (String(recommendedDirection || "").toUpperCase() === "BALANCED" || String(recommendedDirection || "").toUpperCase() === "AGGRESSIVE") {
    addPlan(
      "FLEXI",
      "MEDIUM",
      "Flexi Cap can be used selectively, but only after the most concentrated exposure is diluted.",
      "It keeps growth optional without making the portfolio too narrow."
    );
  } else {
    addPlan(
      "FLEXI",
      "LOW",
      "Add to Flexi only selectively after strengthening the steadier side of the portfolio.",
      "For a conservative direction, fresh money should first improve stability and diversification."
    );
  }

  if (String(recommendedDirection || "").toUpperCase() === "AGGRESSIVE" && longHorizon && !isHighRiskPortfolio) {
    addPlan(
      "SMALL",
      "MEDIUM",
      "Small Cap can be used as a satellite addition, not the core destination for new money.",
      "A long horizon can support some higher-growth allocation, but concentration and drawdown control still matter."
    );
  } else {
    addPlan(
      "SMALL",
      "LOW",
      "Keep Small Cap as optional or minimal for now.",
      "Given the current risk profile and concentration picture, fresh money should not primarily increase the most volatile bucket."
    );
  }

  if (toNumber(currentAllocation?.OTHER) < 10 && (String(recommendedDirection || "").toUpperCase() === "CONSERVATIVE" || isHighRiskPortfolio)) {
    addPlan(
      "OTHER",
      "MEDIUM",
      "Consider using a steadier non-dominant category only if it clearly lowers risk and improves diversification.",
      "This is a secondary option when the portfolio needs balance more than additional growth."
    );
  }

  return {
    style: "ADVISORY",
    note: "These are category priorities for fresh money, not fixed target percentages.",
    categories,
  };
}

function buildReasoning({
  weightedRiskScore,
  overallRiskLevel,
  dominantRiskLevel,
  coverageStats,
  topHoldings,
  recommendedDirection,
  durationMonths,
  expectedRoi,
}) {
  const topHolding = topHoldings[0];
  const holdingNote = topHolding
    ? ` The largest holding is ${topHolding.schemeName} at ${Math.round(topHolding.portfolioShare)}% of current portfolio value.`
    : "";

  return (
    `Verified scheme Risk-o-meter data places the portfolio at an average risk score of ${weightedRiskScore || 0}, which maps to an overall ${formatRiskLabel(
      overallRiskLevel
    )} risk profile across the verified portion of the portfolio. ` +
    `The dominant disclosed risk bucket is ${formatRiskLabel(dominantRiskLevel)}, and ${Math.round(
      coverageStats.officialCoverageByValuePct
    )}% of current value is verified by stored scheme-level risk labels. ` +
    `Given the investor's ${toNumber(durationMonths)}-month horizon and ${toNumber(expectedRoi)}% expected ROI, the suggested stance for fresh investments is ${recommendedDirection}.` +
    holdingNote
  );
}

export async function analyzePortfolio({
  holdings = [],
  categoryPercentages = {},
  durationMonths = 0,
  investmentAmount = 0,
  expectedRoi = 0,
}) {
  const normalizedHoldings = Array.isArray(holdings)
    ? holdings.map((holding) => ({
        scheme_name: holding.scheme_name || holding.schemeName || "Unknown Scheme",
        amfi_code: String(holding.amfi_code || holding.amfiCode || "").trim(),
        category: String(holding.category || "OTHER").toUpperCase(),
        current_value: Math.max(0, toNumber(holding.current_value ?? holding.currentValue)),
        units: toNumber(holding.units),
      }))
    : [];
  const focusedHoldings = normalizedHoldings.filter((holding) => FOCUSED_CATEGORIES.has(holding.category));
  const ignoredHoldings = normalizedHoldings.filter((holding) => !FOCUSED_CATEGORIES.has(holding.category));

  const schemeRiskMap = await fetchSchemeRiskMap(
    focusedHoldings.map((holding) => holding.amfi_code),
    focusedHoldings,
    { allowGemini: false }
  );
  const riskSnapshot = buildHoldingRiskSnapshot(focusedHoldings, schemeRiskMap);
  const coverageStats = buildCoverageStats(riskSnapshot);
  const computedCategoryExposure =
    Object.keys(categoryPercentages || {}).length > 0
      ? Object.fromEntries(
          Object.entries(categoryPercentages)
            .filter(([category]) => FOCUSED_CATEGORIES.has(String(category || "").toUpperCase()))
        )
      : buildCategoryExposure(riskSnapshot);
  const schemeRiskExposure = buildRiskExposure(riskSnapshot);
  const weightedRiskScore = getWeightedRiskScore(riskSnapshot);
  const overallRiskLevel = normalizeRiskLabel(
    coverageStats.officialCoverageByValuePct > 0
      ? Object.entries({
          LOW: Math.abs(weightedRiskScore - 1),
          LOW_TO_MODERATE: Math.abs(weightedRiskScore - 2),
          MODERATE: Math.abs(weightedRiskScore - 3),
          MODERATELY_HIGH: Math.abs(weightedRiskScore - 4),
          HIGH: Math.abs(weightedRiskScore - 5),
          VERY_HIGH: Math.abs(weightedRiskScore - 6),
        }).sort((a, b) => a[1] - b[1])[0]?.[0]
      : "UNKNOWN"
  );
  const dominantRiskLevel = getDominantRiskLevel(schemeRiskExposure);
  const topHoldings = buildTopHoldings(riskSnapshot, 3);
  const topCategoryShare = Math.max(...Object.values(computedCategoryExposure).map((value) => toNumber(value)), 0);
  const topHoldingShare = topHoldings[0]?.portfolioShare || 0;
  const recommendedDirection = getRecommendedDirection({
    weightedRiskScore,
    durationMonths,
    expectedRoi,
  });
  const goalDirection = clampDirectionByDuration(
    getGoalDirection({ durationMonths, expectedRoi }),
    durationMonths
  );
  const roiFeasibility = getRoiFeasibility({
    durationMonths,
    expectedRoi,
    recommendedDirection,
  });
  const diversificationStatus = getDiversificationStatus({
    topHoldingShare,
    topCategoryShare,
    coverageByValuePct: coverageStats.officialCoverageByValuePct,
  });
  const concentrationFlags = buildConcentrationFlags({
    topHoldings,
    categoryExposure: computedCategoryExposure,
    riskExposure: schemeRiskExposure,
    coverageByValuePct: coverageStats.officialCoverageByValuePct,
  });
  const adviceForNewInvestment = buildAdviceForNewInvestment({
    recommendedDirection,
    durationMonths,
    expectedRoi,
    categoryExposure: computedCategoryExposure,
    riskExposure: schemeRiskExposure,
    topHoldings,
    diversificationStatus,
    coverageByValuePct: coverageStats.officialCoverageByValuePct,
  });
  const improvementSteps = buildImprovementSteps({
    adviceForNewInvestment,
    topHoldings,
    diversificationStatus,
  });
  const newInvestmentPlan = buildNewInvestmentPlan({
    recommendedDirection,
    currentAllocation: computedCategoryExposure,
    durationMonths,
    diversificationStatus,
    topHoldings,
    riskExposure: schemeRiskExposure,
    weightedRiskScore,
  });
  const verifiedFunds = riskSnapshot.filter((holding) => holding.riskSource !== "UNAVAILABLE");
  const unverifiedFunds = riskSnapshot.filter((holding) => holding.riskSource === "UNAVAILABLE");

  const aiEvaluation = {
    summary:
      coverageStats.officialCoverageByValuePct > 0
        ? `Portfolio risk review suggests a ${recommendedDirection.toLowerCase()} stance for fresh investments, with ${formatRiskLabel(
            dominantRiskLevel
          )} risk currently the biggest disclosed bucket.`
        : "Portfolio risk review could not verify scheme-level Risk-o-meter data yet, so guidance is limited to concentration-aware next steps.",
    recommendedDirection,
    diversificationStatus,
    riskScore: {
      weightedAverageRiskScore: weightedRiskScore,
      inferredRisk: recommendedDirection,
      officialCoverageByValuePct: coverageStats.officialCoverageByValuePct,
      officialCoverageBySchemePct: coverageStats.officialCoverageBySchemePct,
    },
    goalAssessment: {
      durationMonths: toNumber(durationMonths),
      expectedRoi: toNumber(expectedRoi),
      goalDirection,
      roiFeasibility,
    },
    currentAllocation: computedCategoryExposure,
    categoryExposure: computedCategoryExposure,
    newInvestmentPlan,
    schemeRiskExposure,
    portfolioRiskView: {
      overallRiskLevel,
      dominantRiskLevel,
      verifiedPortfolioValue: coverageStats.verifiedValue,
      totalPortfolioValue: coverageStats.totalValue,
      officialCoverageByValuePct: coverageStats.officialCoverageByValuePct,
      officialCoverageBySchemePct: coverageStats.officialCoverageBySchemePct,
    },
    topHoldings,
    verifiedFunds: verifiedFunds.map((holding) => ({
      schemeName: holding.scheme_name,
      amfiCode: holding.amfi_code,
      riskLabel: holding.riskLabel,
      currentValue: holding.current_value,
      riskSource: holding.riskSource,
      riskSourceUrl: holding.riskSourceUrl,
      riskAsOfDate: holding.riskAsOfDate,
      riskAsOfDateText: holding.riskAsOfDateText,
      riskVerificationStatus: holding.riskVerificationStatus,
      volatilityPct: holding.volatilityPct,
      maxDrawdownPct: holding.maxDrawdownPct,
      derivedRiskScore: holding.derivedRiskScore,
    })),
    unverifiedFunds: unverifiedFunds.map((holding) => ({
      schemeName: holding.scheme_name,
      amfiCode: holding.amfi_code,
      currentValue: holding.current_value,
      riskSource: holding.riskSource,
    })),
    ignoredFunds: ignoredHoldings.map((holding) => ({
      schemeName: holding.scheme_name,
      amfiCode: holding.amfi_code,
      category: holding.category,
      reason: "Ignored because recommendation scope is limited to ETF, FLEXI, and SMALL categories.",
    })),
    concentrationFlags,
    detailedExplanation: {
      riskProfileExplanation: "",
      portfolioReasoning: buildReasoning({
        weightedRiskScore,
        overallRiskLevel,
        dominantRiskLevel,
        coverageStats,
        topHoldings,
        recommendedDirection,
        durationMonths,
        expectedRoi,
      }),
      newInvestmentReasoning:
        "Fresh-investment guidance is based on verified scheme risk labels, concentration checks, current category mix, and the investor's stated horizon and ROI expectation. It intentionally avoids exact target percentages.",
    },
    adviceForNewInvestment,
    improvementSteps,
  };

  aiEvaluation.detailedExplanation.riskProfileExplanation = buildRiskProfileNarrative(aiEvaluation);

  try {
    const llmRecommendation = await generateInitialRecommendationWithGemini({
      analysisResult: {
        aiEvaluation,
        inputs: {
          durationMonths: toNumber(durationMonths),
          investmentAmount: toNumber(investmentAmount),
          expectedRoi: toNumber(expectedRoi),
          holdingsReviewed: focusedHoldings.length,
          holdingsIgnored: ignoredHoldings.length,
        },
        recommendedDirection,
      },
    });

    if (llmRecommendation.summary) {
      aiEvaluation.summary = llmRecommendation.summary;
    }
    if (llmRecommendation.reasoning) {
      aiEvaluation.detailedExplanation.newInvestmentReasoning = llmRecommendation.reasoning;
    }
    if (llmRecommendation.adviceForNewInvestment.length) {
      aiEvaluation.adviceForNewInvestment = llmRecommendation.adviceForNewInvestment;
    }
    if (llmRecommendation.nextSteps.length) {
      aiEvaluation.improvementSteps = llmRecommendation.nextSteps;
    }
    aiEvaluation.llm = {
      provider: "GEMINI",
      model: llmRecommendation.model,
      status: "SUCCESS",
    };
  } catch (error) {
    const isRateLimit = String(error.message).includes("429");
    aiEvaluation.llm = {
      provider: "GEMINI",
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
      status: "FALLBACK",
      isRateLimit,
      error: isRateLimit ? "Rate limit reached" : error.message,
    };
    console.error("Gemini failed, using rule-based fallback:", error.message);
  }

  return {
    inferredRisk: overallRiskLevel,
    recommendedDirection,
    aiEvaluation,
    inputs: {
      durationMonths: toNumber(durationMonths),
      investmentAmount: toNumber(investmentAmount),
      expectedRoi: toNumber(expectedRoi),
      holdingsReviewed: focusedHoldings.length,
      holdingsIgnored: ignoredHoldings.length,
    },
  };
}
