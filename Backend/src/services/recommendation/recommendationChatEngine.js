import {
  clampDirectionByDuration,
  formatRiskLabel,
  getGoalDirection,
  getRoiFeasibility,
  normalizeDirection,
  normalizeDiversificationStatus,
  normalizeRiskLabel,
  toNumber,
} from "./riskometerUtils.js";
import {
  buildRiskProfileNarrative,
  generateChatRecommendationWithGemini,
} from "./geminiRecommendation.service.js";

function buildPlanningContext(baseRecommendation = {}, planningContext = {}) {
  const durationMonths = toNumber(
    planningContext.durationMonths,
    toNumber(baseRecommendation?.goalAssessment?.durationMonths)
  );
  const expectedRoi = toNumber(
    planningContext.expectedRoi,
    toNumber(baseRecommendation?.goalAssessment?.expectedRoi)
  );
  const investmentAmount = toNumber(planningContext.investmentAmount);
  const recommendedDirection = normalizeDirection(baseRecommendation?.recommendedDirection, "CONSERVATIVE");
  const goalDirection = clampDirectionByDuration(
    getGoalDirection({ durationMonths, expectedRoi }),
    durationMonths
  );

  return {
    durationMonths,
    expectedRoi,
    investmentAmount,
    goalDirection,
    roiFeasibility: getRoiFeasibility({
      durationMonths,
      expectedRoi,
      recommendedDirection,
    }),
  };
}

function extractIntent(message = "") {
  const m = String(message || "").toLowerCase();
  return {
    asksWhy: /\b(why|explain|reason|because)\b/.test(m),
    wantsGrowth: /\b(growth|aggressive|higher return|high return|increase return|wealth creation)\b/.test(m),
    wantsSafety: /\b(safe|safer|safety|less risk|low risk|capital preservation|stable)\b/.test(m),
    wantsDiversification: /\b(diversify|diversification|concentrat|overweight|rebalance)\b/.test(m),
    asksAboutNewMoney: /\b(new amount|new money|fresh investment|invest now|how should i invest|where should i invest)\b/.test(m),
    asksAboutSmall: /\bsmall\b/.test(m),
    asksAboutFlexi: /\bflexi\b/.test(m),
    asksAboutEtf: /\betf\b/.test(m),
  };
}

function buildDurationComment({ durationMonths, roiFeasibility }) {
  if (durationMonths <= 12) {
    return `The horizon is short at ${durationMonths} months, so fresh money should not intensify already high-volatility exposure.`;
  }
  if (durationMonths <= 36) {
    return `The horizon is medium term at ${durationMonths} months, which supports measured equity exposure but still rewards better diversification discipline.`;
  }
  if (roiFeasibility === "STRETCH") {
    return `The longer horizon helps, but the requested return still requires a disciplined growth-oriented approach rather than concentrated bets.`;
  }
  return `The longer horizon gives room to use fresh investments for quality diversification without relying on narrow high-risk concentration.`;
}

function buildRiskTradeoff(baseRecommendation = {}, intent = {}) {
  const riskExposure = baseRecommendation?.schemeRiskExposure || {};
  const veryHigh = toNumber(riskExposure.VERY_HIGH);
  const high = toNumber(riskExposure.HIGH);
  const categoryExposure = baseRecommendation?.categoryExposure || baseRecommendation?.currentAllocation || {};

  if (intent.wantsGrowth) {
    return veryHigh >= 40
      ? "The portfolio already carries meaningful high-end risk, so seeking more growth should come through broader diversified additions rather than adding to the riskiest slice."
      : "Growth can be pursued, but the safer route is to add through diversified equity exposure instead of creating fresh concentration.";
  }

  if (intent.wantsSafety) {
    return high + veryHigh >= 50
      ? "Reducing downside sensitivity means fresh money should move toward the steadier part of the portfolio, not into the highest-risk holdings."
      : "The portfolio is not excessively risk-heavy, so safety can improve mainly through disciplined diversification and avoiding concentration.";
  }

  if (toNumber(categoryExposure.SMALL) >= 25) {
    return "Small-cap exposure is already meaningful, so additional fresh money there would increase volatility faster than diversification quality.";
  }

  return "The main tradeoff is between adding growth and keeping concentration under control; fresh money works best when it strengthens diversification instead of repeating current overweights.";
}

function buildReply({ baseRecommendation, planningContext, userMessage }) {
  const intent = extractIntent(userMessage);
  const riskView = baseRecommendation?.portfolioRiskView || {};
  const topHolding = Array.isArray(baseRecommendation?.topHoldings) ? baseRecommendation.topHoldings[0] : null;
  const advice = Array.isArray(baseRecommendation?.adviceForNewInvestment)
    ? [...baseRecommendation.adviceForNewInvestment]
    : [];
  const dominantRiskLevel = normalizeRiskLabel(riskView.dominantRiskLevel);
  const diversificationStatus = normalizeDiversificationStatus(baseRecommendation?.diversificationStatus);

  if (intent.wantsSafety) {
    advice.unshift("Use fresh money to strengthen the lower-volatility, less concentrated side of the portfolio.");
  }
  if (intent.wantsGrowth) {
    advice.unshift("If growth is the priority, increase risk only through diversified additions and not by doubling down on the most volatile current holdings.");
  }
  if (intent.wantsDiversification) {
    advice.unshift("Treat fresh investment as the main diversification tool: avoid adding to the most concentrated scheme or category first.");
  }

  const shortLead = intent.asksWhy
    ? `Because the verified portfolio is currently led by ${formatRiskLabel(dominantRiskLevel)} risk exposure, the advice is about where not to add new concentration rather than forcing exact percentages.`
    : intent.asksAboutNewMoney || intent.wantsGrowth || intent.wantsSafety || intent.wantsDiversification
      ? "The better use of fresh money is to improve diversification and risk balance, not to mirror the current portfolio blindly."
      : "The current guidance stays focused on verified risk exposure and concentration control.";

  const focusLine = topHolding && diversificationStatus === "OVERCONCENTRATED"
    ? `The biggest immediate watchpoint is ${topHolding.schemeName}, which already carries ${Math.round(
        toNumber(topHolding.portfolioShare)
      )}% of portfolio value.`
    : `The portfolio's dominant disclosed risk bucket is ${formatRiskLabel(dominantRiskLevel)}.`;

  const reasonLine = intent.asksAboutSmall
    ? "Small-cap exposure should only receive fresh money if the investor accepts higher volatility and the holding is not already dominant."
    : intent.asksAboutEtf
      ? "ETF or similarly broad exposure helps when the goal is to add stability without completely stepping away from market participation."
      : intent.asksAboutFlexi
        ? "Flexi-style diversified exposure is useful when you want growth with less concentration than a narrow thematic or already dominant slice."
        : "";

  return {
    reply: [shortLead, focusLine, reasonLine].filter(Boolean).join(" "),
    nextSteps: [...new Set(advice)].slice(0, 5),
    analysis: {
      roiFeasibility: planningContext.roiFeasibility,
      durationComment: buildDurationComment(planningContext),
      riskTradeoff: buildRiskTradeoff(baseRecommendation, intent),
    },
  };
}

export async function chatOnRecommendation({
  baseRecommendation,
  planningContext,
  chatHistory,
  userMessage,
}) {
  const mergedRecommendation = baseRecommendation || {};
  const context = buildPlanningContext(mergedRecommendation, planningContext);
  const result = buildReply({
    baseRecommendation: mergedRecommendation,
    planningContext: context,
    userMessage,
    chatHistory,
  });

  const fallbackReply =
    result.reply ||
    mergedRecommendation?.summary ||
    "Fresh-investment guidance remains focused on verified risk exposure and concentration control.";
  const fallbackNextSteps = result.nextSteps;
  const fallbackReasoning = mergedRecommendation?.detailedExplanation?.portfolioReasoning
    || mergedRecommendation?.reasoning
    || "This guidance is derived from verified scheme risk labels, concentration checks, and the investor's stated horizon and ROI expectation.";

  const llmResponse = await generateChatRecommendationWithGemini({
    baseRecommendation: mergedRecommendation,
    planningContext: context,
    chatHistory,
    userMessage,
    fallbackReply,
    fallbackNextSteps,
    fallbackAnalysis: result.analysis,
  });

  const summary = llmResponse.reply || fallbackReply;
  const nextSteps = llmResponse.nextSteps.length ? llmResponse.nextSteps : fallbackNextSteps;
  const recommendedDirection = llmResponse.recommendedDirection
    || normalizeDirection(mergedRecommendation?.recommendedDirection, "CONSERVATIVE");
  const chatbotReasoning = llmResponse.reasoning || fallbackReasoning;
  const llmMeta = {
    provider: "GEMINI",
    model: llmResponse.model || process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
    status: "SUCCESS",
  };

  return {
    reply: summary,
    llm: llmMeta,
    analysis: result.analysis,
    changeControl: {
      status: "NONE",
      approvalRequired: false,
      proposedTargetAllocation: null,
    },
    finalRecommendation: {
      recommendedDirection,
      summary,
      currentAllocation: mergedRecommendation?.currentAllocation || {},
      categoryExposure: mergedRecommendation?.categoryExposure || mergedRecommendation?.currentAllocation || {},
      newInvestmentPlan: mergedRecommendation?.newInvestmentPlan || {},
      weightedAverageRiskScore: mergedRecommendation?.riskScore?.weightedAverageRiskScore || 0,
      schemeRiskExposure: mergedRecommendation?.schemeRiskExposure || {},
      portfolioRiskView: mergedRecommendation?.portfolioRiskView || {},
      concentrationFlags: mergedRecommendation?.concentrationFlags || [],
      adviceForNewInvestment: nextSteps,
      reasoning: chatbotReasoning,
      riskProfileExplanation:
        mergedRecommendation?.detailedExplanation?.riskProfileExplanation
        || buildRiskProfileNarrative(mergedRecommendation),
      nextSteps,
      roiFeasibility: context.roiFeasibility,
      consideredUserStatement: String(userMessage || "").slice(0, 300),
      llm: llmMeta,
    },
  };
}
