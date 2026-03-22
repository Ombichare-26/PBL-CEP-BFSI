function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampPct(n) {
  return Math.max(0, Math.min(100, Math.round(toNumber(n))));
}

function normalizeDirection(value, fallback = "CONSERVATIVE") {
  const v = String(value || "").toUpperCase();
  if (v === "AGGRESSIVE" || v === "BALANCED" || v === "CONSERVATIVE") return v;
  return fallback;
}

function normalizeRoiFeasibility(value, fallback = "REALISTIC") {
  const v = String(value || "").toUpperCase();
  if (v === "REALISTIC" || v === "STRETCH" || v === "UNREALISTIC") return v;
  return fallback;
}

function normalizeAllocation(allocation = {}) {
  let etf = clampPct(allocation.ETF);
  let flexi = clampPct(allocation.FLEXI);
  let small = clampPct(allocation.SMALL);

  const total = etf + flexi + small;
  if (total === 100) {
    return { ETF: etf, FLEXI: flexi, SMALL: small };
  }

  if (total === 0) {
    return { ETF: 60, FLEXI: 30, SMALL: 10 };
  }

  etf = Math.round((etf / total) * 100);
  flexi = Math.round((flexi / total) * 100);
  small = 100 - etf - flexi;

  if (small < 0) {
    const overflow = Math.abs(small);
    etf = Math.max(0, etf - overflow);
    small = 100 - etf - flexi;
  }

  return { ETF: etf, FLEXI: flexi, SMALL: small };
}

function extractJsonFromText(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_error) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch (_innerError) {
      return null;
    }
  }
}

function inferRoiFeasibility({ durationMonths, expectedRoi, recommendedDirection }) {
  const months = toNumber(durationMonths);
  const roi = toNumber(expectedRoi);
  const direction = normalizeDirection(recommendedDirection);

  if (months < 12 && roi >= 12) return "UNREALISTIC";
  if (months < 24 && roi >= 15) return "UNREALISTIC";
  if (direction === "CONSERVATIVE" && roi >= 14) return "UNREALISTIC";
  if (direction === "BALANCED" && roi >= 18) return "STRETCH";
  if (direction === "AGGRESSIVE" && roi >= 22) return "STRETCH";
  return "REALISTIC";
}

function buildPlanningContext(baseRecommendation, planningContext = {}) {
  const durationMonths = toNumber(
    planningContext.durationMonths,
    toNumber(baseRecommendation?.goalAssessment?.durationMonths)
  );
  const expectedRoi = toNumber(
    planningContext.expectedRoi,
    toNumber(baseRecommendation?.goalAssessment?.expectedRoi)
  );
  const investmentAmount = toNumber(planningContext.investmentAmount);

  const recommendedDirection = normalizeDirection(baseRecommendation?.recommendedDirection);
  const fallbackFeasibility = inferRoiFeasibility({
    durationMonths,
    expectedRoi,
    recommendedDirection,
  });

  const roiFeasibility = normalizeRoiFeasibility(
    planningContext.roiFeasibility || baseRecommendation?.goalAssessment?.roiFeasibility,
    fallbackFeasibility
  );

  return {
    durationMonths,
    expectedRoi,
    investmentAmount,
    roiFeasibility,
  };
}

function buildFallbackResponse(baseRecommendation, planningContext, userMessage) {
  const targetAllocation = normalizeAllocation(baseRecommendation?.targetAllocation || {});
  const recommendedDirection = normalizeDirection(baseRecommendation?.recommendedDirection);
  const p = buildPlanningContext(baseRecommendation, planningContext);

  return {
    reply:
      "I considered your constraints with ROI, time horizon, and investable amount. The final recommendation below reflects feasibility and diversification balance.",
    finalRecommendation: {
      recommendedDirection,
      summary:
        `Final recommendation is ${recommendedDirection} for ${p.durationMonths || 0} months and expected ROI ${p.expectedRoi || 0}%, with ETF ${targetAllocation.ETF}%, FLEXI ${targetAllocation.FLEXI}%, SMALL ${targetAllocation.SMALL}%.`,
      roiFeasibility: p.roiFeasibility,
      targetAllocation,
      allocationReasoning:
        "This target mix balances risk and growth with your stated horizon and ROI expectation while preserving diversification across ETF, Flexi, and Small categories.",
      nextSteps: [
        "Review whether your expected ROI is achievable for your selected duration.",
        "Use SIP-based increases in underweight categories to move toward target allocation.",
        "Recheck allocation after market moves or major life-goal changes.",
      ],
      consideredUserStatement: String(userMessage || "").slice(0, 300),
    },
  };
}

function buildChatPrompt({ baseRecommendation, planningContext, chatHistory, userMessage }) {
  const currentAllocation = baseRecommendation?.currentAllocation || {};
  const targetAllocation = baseRecommendation?.targetAllocation || {};
  const recommendedDirection = normalizeDirection(baseRecommendation?.recommendedDirection);
  const summary = String(baseRecommendation?.summary || "");
  const p = buildPlanningContext(baseRecommendation, planningContext);

  const historyBlock = (chatHistory || [])
    .slice(-12)
    .map((m) => `${String(m.role || "user").toUpperCase()}: ${String(m.content || "")}`)
    .join("\n");

  return `You are an expert Indian mutual fund allocation advisor in follow-up consultation mode.

Your job is to refine the recommendation after the user's additional statements.
Use the planning context (expected ROI, duration, investment amount) to evaluate feasibility and explain tradeoffs clearly.

Baseline recommendation:
- recommendedDirection: ${recommendedDirection}
- summary: ${summary}
- currentAllocation: ${JSON.stringify(currentAllocation)}
- targetAllocation: ${JSON.stringify(targetAllocation)}
- durationMonths: ${p.durationMonths}
- expectedRoi: ${p.expectedRoi}
- investmentAmount: ${p.investmentAmount}
- currentRoiFeasibility: ${p.roiFeasibility}

Conversation so far:
${historyBlock || "(no previous messages)"}

Latest user statement:
${String(userMessage || "")}

Quality requirements:
1. Give detailed, user-specific reasoning. Avoid generic one-liners.
2. Explain feasibility based on expected ROI and duration explicitly.
3. Mention what changes in allocation are needed and why.
4. Keep percentages non-negative.
5. finalRecommendation.targetAllocation must have ETF/FLEXI/SMALL and sum to 100.
6. Do not suggest specific fund names.
7. Keep advice actionable and coherent with conversation.

Return strict JSON only:
{
  "reply": "string",
  "analysis": {
    "roiFeasibility": "REALISTIC" | "STRETCH" | "UNREALISTIC",
    "durationComment": "string",
    "riskTradeoff": "string"
  },
  "finalRecommendation": {
    "recommendedDirection": "AGGRESSIVE" | "BALANCED" | "CONSERVATIVE",
    "summary": "string",
    "targetAllocation": { "ETF": number, "FLEXI": number, "SMALL": number },
    "allocationReasoning": "string",
    "nextSteps": ["string", "string", "string"],
    "roiFeasibility": "REALISTIC" | "STRETCH" | "UNREALISTIC",
    "consideredUserStatement": "string"
  }
}`;
}

export async function chatOnRecommendation({
  baseRecommendation,
  planningContext,
  chatHistory,
  userMessage,
}) {
  const prompt = buildChatPrompt({
    baseRecommendation,
    planningContext,
    chatHistory,
    userMessage,
  });

  let response;
  try {
    response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3:8b",
        prompt,
        stream: false,
      }),
    });
  } catch (_error) {
    throw new Error("Ollama is not reachable at http://localhost:11434. Start it with 'ollama serve' and pull 'llama3:8b'.");
  }

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const parsed = extractJsonFromText(data?.response);

  if (!parsed || typeof parsed !== "object") {
    return buildFallbackResponse(baseRecommendation, planningContext, userMessage);
  }

  const fallback = buildFallbackResponse(baseRecommendation, planningContext, userMessage);
  const finalRecommendation = parsed.finalRecommendation || {};
  const p = buildPlanningContext(baseRecommendation, planningContext);

  return {
    reply: String(parsed.reply || fallback.reply),
    analysis: {
      roiFeasibility: normalizeRoiFeasibility(
        parsed?.analysis?.roiFeasibility,
        fallback.finalRecommendation.roiFeasibility
      ),
      durationComment: String(parsed?.analysis?.durationComment || ""),
      riskTradeoff: String(parsed?.analysis?.riskTradeoff || ""),
    },
    finalRecommendation: {
      recommendedDirection: normalizeDirection(
        finalRecommendation.recommendedDirection,
        fallback.finalRecommendation.recommendedDirection
      ),
      summary: String(finalRecommendation.summary || fallback.finalRecommendation.summary),
      targetAllocation: normalizeAllocation(
        finalRecommendation.targetAllocation || fallback.finalRecommendation.targetAllocation
      ),
      allocationReasoning: String(
        finalRecommendation.allocationReasoning || fallback.finalRecommendation.allocationReasoning
      ),
      nextSteps: Array.isArray(finalRecommendation.nextSteps)
        ? finalRecommendation.nextSteps.filter(Boolean).map((s) => String(s)).slice(0, 5)
        : fallback.finalRecommendation.nextSteps,
      roiFeasibility: normalizeRoiFeasibility(
        finalRecommendation.roiFeasibility,
        p.roiFeasibility
      ),
      consideredUserStatement: String(
        finalRecommendation.consideredUserStatement || String(userMessage || "").slice(0, 300)
      ),
    },
  };
}
