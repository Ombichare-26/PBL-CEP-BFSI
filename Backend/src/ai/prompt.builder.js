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

  return `
You are an expert portfolio analyst. Your primary goal is to explain and justify the system's authoritative risk assessment to the user. The system's risk evaluation is the ground truth.

**System's Authoritative Evaluation:**
- **Inferred Portfolio Risk:** ${inferredRisk}
- **User's Chosen Direction:** ${userSelectedDirection}

**Your Task:**
1.  **State the Verdict:** Start by stating whether the user's chosen direction (${userSelectedDirection}) aligns with the system's inferred risk (${inferredRisk}). Your verdict MUST be consistent with the system's evaluation.
2.  **Provide a Summary:** Briefly explain *why* there is an alignment or misalignment in 1-2 sentences.
3.  **Suggest a Direction:** If there is a misalignment, recommend the appropriate direction. If they align, affirm the user's choice.
        4.  **Give a Detailed Explanation:** Justify your verdict by analyzing the following factors. Connect them back to the inferred risk. This is a mandatory section.
            -   **Allocation Analysis:** How does the portfolio's allocation contribute to the overall risk?
            -   **Risk vs. Direction:** Explain the relationship between the portfolio's risk level and the user's chosen investment style.
            -   **Duration Impact:** How does the investment duration (${
              durationMonths / 12
            } years) affect the risk and potential returns?
            -   **ROI Expectation:** Is the user's expected ROI (${expectedRoi}%) realistic given the portfolio's risk and duration? Your analysis of the ROI is mandatory.

        **User's Financial Context:**
        -   **Investment Amount:** ₹${investmentAmount}
        -   **Portfolio Allocation:** ${JSON.stringify(categoryPercentages)}


**System Calculation Factors (for your reference, do not show to user):**
${factorSection}
`;
}
