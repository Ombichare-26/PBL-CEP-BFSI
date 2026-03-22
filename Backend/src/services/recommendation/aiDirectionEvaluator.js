import { callOllama } from "../../ai/ollama.client.js";
import { buildDirectionEvaluationPrompt } from "../../ai/prompt.builder.js";

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDirection(value, fallback) {
  const v = String(value || "").toUpperCase();
  if (v === "AGGRESSIVE" || v === "BALANCED" || v === "CONSERVATIVE") return v;
  return fallback;
}

function normalizeDiversificationStatus(value, fallback) {
  const v = String(value || "").toUpperCase();
  if (v === "WELL_DIVERSIFIED" || v === "OVERCONCENTRATED" || v === "UNDEREXPOSED") return v;
  return fallback;
}

function formatCategory(category) {
  const c = String(category || "").toUpperCase();
  if (c === "FLEXI") return "Flexi";
  if (c === "SMALL") return "Small";
  return c;
}

function buildDeterministicSummary(recommendedDirection) {
  const dir = String(recommendedDirection || "").toUpperCase();
  const title = dir.charAt(0) + dir.slice(1).toLowerCase();
  return `${title} portfolio allocation is suitable for the user's risk profile and investment goals.`;
}

function buildDeterministicReasoning({
  currentAllocation,
  targetAllocation,
  recommendedDirection,
}) {
  const c = currentAllocation || {};
  const t = targetAllocation || {};
  return `Given the user's ${String(recommendedDirection || "").toLowerCase()} risk profile and investment goals, a target allocation of ${toNumber(
    t.ETF
  )}% ETF, ${toNumber(t.FLEXI)}% FLEXI, and ${toNumber(t.SMALL)}% SMALL is suitable. This allocation transitions from the current mix (${toNumber(
    c.ETF
  )}% ETF, ${toNumber(c.FLEXI)}% FLEXI, ${toNumber(
    c.SMALL
  )}% SMALL) toward better diversification while keeping the recommendation direction unchanged.`;
}

function buildDeterministicImprovementSteps({ currentAllocation, targetAllocation }) {
  const current = currentAllocation || {};
  const target = targetAllocation || {};
  const categories = ["ETF", "FLEXI", "SMALL"];
  const steps = [];

  for (const category of categories) {
    const c = toNumber(current[category]);
    const t = toNumber(target[category]);
    const diff = Number((t - c).toFixed(0));
    if (diff > 0) {
      steps.push(
        `Increase ${formatCategory(category)} allocation by ${diff}% (from ${Math.round(
          c
        )}% to ${Math.round(t)}%).`
      );
    }
  }

  for (const category of categories) {
    const c = toNumber(current[category]);
    const t = toNumber(target[category]);
    if (t < c) {
      steps.push(
        `Pause fresh allocation to ${formatCategory(
          category
        )} and direct new investments to underweight categories until ${formatCategory(
          category
        )} moves closer to ${Math.round(t)}%.`
      );
    }
  }

  if (steps.length === 0) {
    steps.push("Maintain current category mix with periodic rechecks to keep allocations aligned.");
  }

  return steps.slice(0, 3);
}

function buildNormalizedRecommendation({
  modelOutput,
  categoryPercentages,
  inferredRisk,
  durationMonths,
  expectedRoi,
  structuredFactors,
  recommendationContext,
}) {
  const fallbackRecommendedDirection = normalizeDirection(
    recommendationContext?.recommendedDirection,
    "CONSERVATIVE"
  );

  const normalized = {
    summary: buildDeterministicSummary(fallbackRecommendedDirection),
    recommendedDirection: fallbackRecommendedDirection,
    diversificationStatus: normalizeDiversificationStatus(
      modelOutput?.diversificationStatus,
      recommendationContext?.diversificationStatus || "WELL_DIVERSIFIED"
    ),
    riskScore: {
      rawScore: toNumber(structuredFactors?.rawScore),
      durationMultiplier: toNumber(structuredFactors?.durationMultiplier, 1),
      amountPenalty: toNumber(structuredFactors?.amountPenalty),
      finalScore: toNumber(structuredFactors?.finalScore),
      inferredRisk: normalizeDirection(inferredRisk, "CONSERVATIVE"),
    },
    goalAssessment: {
      durationMonths: toNumber(durationMonths),
      expectedRoi: toNumber(expectedRoi),
      goalDirection: normalizeDirection(recommendationContext?.goalDirection, "CONSERVATIVE"),
      roiFeasibility: String(recommendationContext?.roiFeasibility || modelOutput?.goalAssessment?.roiFeasibility || "REALISTIC").toUpperCase(),
    },
    currentAllocation: categoryPercentages || {},
    targetAllocation: recommendationContext?.targetAllocation || {},
    allocationDiff: recommendationContext?.allocationDiff || {},
    detailedExplanation: {
      targetAllocationReasoning: buildDeterministicReasoning({
        currentAllocation: categoryPercentages,
        targetAllocation: recommendationContext?.targetAllocation || {},
        recommendedDirection: fallbackRecommendedDirection,
      }),
    },
    improvementSteps: buildDeterministicImprovementSteps({
      currentAllocation: categoryPercentages,
      targetAllocation: recommendationContext?.targetAllocation || {},
    }),
  };

  return normalized;
}

export async function evaluateDirectionWithAI({
  categoryPercentages,
  inferredRisk,
  durationMonths,
  investmentAmount,
  expectedRoi,
  structuredFactors,
  recommendationContext,
}) {
  const prompt = buildDirectionEvaluationPrompt({
    categoryPercentages,
    inferredRisk,
    durationMonths,
    investmentAmount,
    expectedRoi,
    structuredFactors,
    recommendationContext,
  });

  const modelOutput = await callOllama(prompt);
  return buildNormalizedRecommendation({
    modelOutput,
    categoryPercentages,
    inferredRisk,
    durationMonths,
    expectedRoi,
    structuredFactors,
    recommendationContext,
  });
}
