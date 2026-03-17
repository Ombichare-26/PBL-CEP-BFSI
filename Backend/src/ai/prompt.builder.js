export function buildDirectionEvaluationPrompt({
  categoryPercentages,
  inferredRisk,
  durationMonths,
  investmentAmount,
  expectedRoi,
  structuredFactors,
  recommendationContext,
}) {
  const factorSection = structuredFactors
    ? `
System Factors (for transparency):
- Weights: risk=${structuredFactors.factorWeights.risk}, volatility=${structuredFactors.factorWeights.volatility}, stability=${structuredFactors.factorWeights.stability}
- Raw Score: ${structuredFactors.rawScore}
- Duration Multiplier: ${structuredFactors.durationMultiplier}
- Amount Penalty: ${structuredFactors.amountPenalty}
- Final Score: ${structuredFactors.finalScore}
- Contributions:
${(structuredFactors.contributions || [])
  .map(
    (c) =>
      `  • ${c.category}: ${c.percentage}% → weightedBase=${c.weightedBase}, contribution=${c.contribution}`
  )
  .join("\n")}
`
    : "";

return `
STRICT MODE ACTIVATED.
INPUT IS COMPLETE.
DO NOT REQUEST ADDITIONAL DATA.
PROCEED WITH EVALUATION.
You are an expert portfolio strategist and diversification advisor for Indian mutual fund investments.

The system's inferred risk (${inferredRisk}) is authoritative and must not be changed.
The system's recommendedDirection (${recommendationContext?.recommendedDirection}) and targetAllocation are authoritative and must not be changed.

Your role is to:
1. Explain the system's targetAllocation using the user's inputs and currentAllocation.
2. Justify why each category percentage in targetAllocation is chosen.
3. Keep outputs consistent with the locked targetAllocation and allocationDiff.

================ INVESTMENT DIRECTIONS ================
- Aggressive: High equity exposure, high volatility tolerance.
- Balanced: Moderate equity exposure.
- Conservative: Low volatility, capital preservation focus.

================ FUND CATEGORY RISK LOGIC ================
- ETF: Relatively stable equity exposure.
- Flexi Cap: Moderate-to-high risk diversified equity.
- Small Cap: High risk, high volatility.

================ DIVERSIFICATION RULES ================
- If any single category exceeds 70%, flag concentration risk.
- If one category is below 5%, mention underexposure.
- Conservative portfolios should not be 100% ETF.
- Balanced portfolios should include ETF + Flexi Cap.
- Aggressive portfolios should include meaningful Small Cap exposure.
- Do NOT recalculate percentages.
- Do NOT suggest specific fund names.
- Do NOT calculate returns.

================ USER CONTEXT ================
- Inferred Risk: ${inferredRisk}
- Recommended Direction (LOCKED): ${recommendationContext?.recommendedDirection}
- Goal Direction (from duration+ROI): ${recommendationContext?.goalDirection}
- ROI Feasibility: ${recommendationContext?.roiFeasibility}
- Duration: ${durationMonths / 12} years
- Investment Amount: ₹${investmentAmount}
- Expected ROI: ${expectedRoi}%
- Portfolio Allocation: ${JSON.stringify(categoryPercentages)}
- Target Allocation (LOCKED): ${JSON.stringify(recommendationContext?.targetAllocation || {})}
- Allocation Diff (LOCKED: target - current): ${JSON.stringify(recommendationContext?.allocationDiff || {})}
- Diversification Notes: ${JSON.stringify(recommendationContext?.diversificationNotes || [])}
- Diversification Status (LOCKED): ${recommendationContext?.diversificationStatus}

================ SYSTEM CALCULATION FACTORS ================
${factorSection}

================ OUTPUT FORMAT (STRICT JSON ONLY) ================
Return ONLY valid JSON:

{
  "summary": "one-line conclusion",
  "recommendedDirection": "AGGRESSIVE" | "BALANCED" | "CONSERVATIVE",
  "diversificationStatus": "WELL_DIVERSIFIED" | "OVERCONCENTRATED" | "UNDEREXPOSED",
  "riskScore": {
    "rawScore": number,
    "durationMultiplier": number,
    "amountPenalty": number,
    "finalScore": number,
    "inferredRisk": "AGGRESSIVE" | "BALANCED" | "CONSERVATIVE"
  },
  "goalAssessment": {
    "durationMonths": number,
    "expectedRoi": number,
    "goalDirection": "AGGRESSIVE" | "BALANCED" | "CONSERVATIVE",
    "roiFeasibility": "REALISTIC" | "STRETCH" | "UNREALISTIC"
  },
  "currentAllocation": { "ETF": number, "FLEXI": number, "SMALL": number },
  "targetAllocation": { "ETF": number, "FLEXI": number, "SMALL": number },
  "allocationDiff": { "ETF": number, "FLEXI": number, "SMALL": number },
  "detailedExplanation": {
    "targetAllocationReasoning": "string"
  },
  "improvementSteps": ["string", "string", "string"]
}

Do not include markdown.
Do not include explanation outside JSON.
The response MUST begin with '{' and end with '}'.
No characters before or after JSON.
You MUST copy recommendedDirection, targetAllocation, and allocationDiff exactly from the prompt values.
You MUST set currentAllocation exactly equal to Portfolio Allocation values (do not adjust totals).
You MUST NOT include the keys: verdict, suggestedDirection, diversificationSuggestions.
All strings must be double-quoted JSON strings. Never output unquoted tokens like ... or STRETCH without quotes.
You MUST NOT include any other keys inside detailedExplanation besides targetAllocationReasoning.
`;}
