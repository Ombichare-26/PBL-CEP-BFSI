export function buildDirectionEvaluationPrompt({
  userSelectedDirection,
  categoryPercentages,
  inferredRisk,
  durationMonths,
  investmentAmount,
  expectedRoi,
  structuredFactors,
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

//   return `
// You are an expert portfolio analyst. Your prYou are an expert portfolio strategist and diversification advisor.

// Your goals are:
// 1. Evaluate whether the user's chosen investment direction aligns with the portfolio risk.
// 2. Analyze portfolio diversification.
// 3. Detect concentration risks.
// 4. Suggest category-level diversification improvements.
// 5. Recommend a better direction if needed.imary goal is to explain and justify the system's authoritative risk assessment to the user. The system's risk evaluation is the ground truth.

// **System's Authoritative Evaluation:**
// - **Inferred Portfolio Risk:** ${inferredRisk}
// - **User's Chosen Direction:** ${userSelectedDirection}

// **Your Task:**
// 1.  **State the Verdict:** Start by stating whether the user's chosen direction (${userSelectedDirection}) aligns with the system's inferred risk (${inferredRisk}). Your verdict MUST be consistent with the system's evaluation.
// 2.  **Provide a Summary:** Briefly explain *why* there is an alignment or misalignment in 1-2 sentences.
// 3.  **Suggest a Direction:** If there is a misalignment, recommend the appropriate direction. If they align, affirm the user's choice.
//         4.  **Give a Detailed Explanation:** Justify your verdict by analyzing the following factors. Connect them back to the inferred risk. This is a mandatory section.
//             -   **Allocation Analysis:** How does the portfolio's allocation contribute to the overall risk?
//             -   **Risk vs. Direction:** Explain the relationship between the portfolio's risk level and the user's chosen investment style.
//             -   **Duration Impact:** How does the investment duration (${
//               durationMonths / 12
//             } years) affect the risk and potential returns?
//             -   **ROI Expectation:** Is the user's expected ROI (${expectedRoi}%) realistic given the portfolio's risk and duration? Your analysis of the ROI is mandatory.

//         **User's Financial Context:**
//         -   **Investment Amount:** ₹${investmentAmount}
//         -   **Portfolio Allocation:** ${JSON.stringify(categoryPercentages)}


// **System Calculation Factors (for your reference, do not show to user):**
// ${factorSection}
// `;
// }


return `
You are an expert portfolio strategist and diversification advisor for Indian mutual fund investments.

The system's inferred risk (${inferredRisk}) is authoritative and must not be changed.

Your role is to:
1. Evaluate whether the user's selected direction aligns with inferred risk.
2. Analyze portfolio diversification.
3. Detect overconcentration or imbalance.
4. Suggest category-level diversification improvements.
5. Recommend a better direction if necessary.

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
- User Selected Direction: ${userSelectedDirection}
- Inferred Risk: ${inferredRisk}
- Duration: ${durationMonths / 12} years
- Investment Amount: ₹${investmentAmount}
- Expected ROI: ${expectedRoi}%
- Portfolio Allocation: ${JSON.stringify(categoryPercentages)}

================ OUTPUT FORMAT (STRICT JSON ONLY) ================
Return ONLY valid JSON:

{
  "verdict": "RIGHT_CHOICE" | "WRONG_CHOICE",
  "summary": "one-line conclusion",
  "diversificationStatus": "WELL_DIVERSIFIED" | "OVERCONCENTRATED" | "UNDEREXPOSED",
  "detailedExplanation": {
    "allocationAnalysis": "...",
    "concentrationRisk": "...",
    "riskVsDirection": "...",
    "durationImpact": "...",
    "roiExpectationCheck": "..."
  },
  "diversificationSuggestions": [
    "Suggestion 1",
    "Suggestion 2"
  ],
  "suggestedDirection": "Aggressive" | "Balanced" | "Conservative"
}

Do not include markdown.
Do not include explanation outside JSON.
`;}
