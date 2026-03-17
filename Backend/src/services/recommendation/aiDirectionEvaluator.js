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
    summary: String(modelOutput?.summary || "").trim() || "Recommendation generated from portfolio risk and user inputs.",
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
      targetAllocationReasoning:
        modelOutput?.detailedExplanation?.targetAllocationReasoning ||
        "",
    },
    improvementSteps: Array.isArray(modelOutput?.improvementSteps)
      ? modelOutput.improvementSteps
      : Array.isArray(modelOutput?.diversificationSuggestions)
        ? modelOutput.diversificationSuggestions
        : [],
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
