import { callOllama } from "../../ai/ollama.client.js";
import { buildDirectionEvaluationPrompt } from "../../ai/prompt.builder.js";

export async function evaluateDirectionWithAI({
  userSelectedDirection,
  categoryPercentages,
  inferredRisk,
  durationMonths,
  investmentAmount,
  expectedRoi,
  structuredFactors,
}) {
  const prompt = buildDirectionEvaluationPrompt({
    userSelectedDirection,
    categoryPercentages,
    inferredRisk,
    durationMonths,
    investmentAmount,
    expectedRoi,
    structuredFactors,
  });

  return await callOllama(prompt);
}
