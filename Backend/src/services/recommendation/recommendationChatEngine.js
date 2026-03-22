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

function allocationsEqual(a = {}, b = {}) {
  return (
    toNumber(a.ETF) === toNumber(b.ETF) &&
    toNumber(a.FLEXI) === toNumber(b.FLEXI) &&
    toNumber(a.SMALL) === toNumber(b.SMALL)
  );
}

function isExplicitAllocationChangeRequest(message) {
  const m = String(message || "").toLowerCase();
  const changeVerb =
    /\b(change|chnage|chage|modify|rebalance|re-?allocate|reallocate|adjust|increase|decrease|reduce|raise|lower|shift|move|update)\b/.test(
      m
    );
  const allocationContext =
    /\b(allocation|portfolio|mix|weight|weights|etf|flexi|small|small cap|%)\b/.test(m);
  const intentPhrase =
    /\b(can you|please|plz|accordingly|as per|based on|considering)\b/.test(m);
  return (changeVerb && allocationContext) || (allocationContext && intentPhrase && m.includes("change"));
}

function buildRuleBasedAllocationAdjustment(baseTargetAllocation = {}, planningContext = {}, message = "") {
  const base = normalizeAllocation(baseTargetAllocation);
  const p = buildPlanningContext({}, planningContext);
  const m = String(message || "").toLowerCase();

  let etf = base.ETF;
  let flexi = base.FLEXI;
  let small = base.SMALL;

  const wantsGrowth =
    /\b(growth|aggressive|higher return|more return|more growth|high growth|increase return)\b/.test(
      m
    );
  const wantsSafety =
    /\b(safer|safety|safe|less risk|low risk|conservative|capital preservation|stable)\b/.test(
      m
    );

  if (wantsGrowth && p.durationMonths >= 24) {
    const shift = p.durationMonths >= 60 ? 10 : p.durationMonths >= 36 ? 8 : 5;
    const takeFromEtf = Math.min(etf - 25, shift);
    if (takeFromEtf > 0) {
      etf -= takeFromEtf;
      const smallBoost = Math.round(takeFromEtf * 0.65);
      small += smallBoost;
      flexi += takeFromEtf - smallBoost;
    }
  } else if (wantsSafety) {
    const shift = 6;
    const takeFromSmall = Math.min(small, Math.round(shift * 0.6));
    const takeFromFlexi = Math.min(flexi - 15, shift - takeFromSmall);
    etf += Math.max(0, takeFromSmall) + Math.max(0, takeFromFlexi);
    small -= Math.max(0, takeFromSmall);
    flexi -= Math.max(0, takeFromFlexi);
  }

  return normalizeAllocation({ ETF: etf, FLEXI: flexi, SMALL: small });
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
  const currentAllocation = normalizeAllocation(baseRecommendation?.currentAllocation || {});
  const asked = String(userMessage || "").toLowerCase();

  const delta = {
    ETF: targetAllocation.ETF - toNumber(currentAllocation.ETF),
    FLEXI: targetAllocation.FLEXI - toNumber(currentAllocation.FLEXI),
    SMALL: targetAllocation.SMALL - toNumber(currentAllocation.SMALL),
  };

  let interactiveReply = `Based on your ${p.durationMonths}-month horizon and ${p.expectedRoi}% expected ROI, this mix keeps risk controlled while still allowing growth.`;

  if (asked.includes("small")) {
    interactiveReply =
      `Small Cap is kept at ${targetAllocation.SMALL}% because your horizon (${p.durationMonths} months) can absorb some volatility, but not at an aggressive level. ` +
      `The ${targetAllocation.SMALL}% allocation adds growth potential while ETF (${targetAllocation.ETF}%) and FLEXI (${targetAllocation.FLEXI}%) provide stability and diversification.`;
  } else if (asked.includes("etf")) {
    interactiveReply =
      `ETF remains the anchor at ${targetAllocation.ETF}% to control volatility for your expected ROI and timeline. ` +
      `Compared to current allocation, ETF adjustment is ${delta.ETF > 0 ? `+${delta.ETF}%` : `${delta.ETF}%`} to keep the plan aligned with feasibility.`;
  } else if (asked.includes("flexi")) {
    interactiveReply =
      `FLEXI at ${targetAllocation.FLEXI}% helps balance stability and growth between ETF and Small Cap. ` +
      `This makes the portfolio less concentrated and improves diversification quality for your target ROI path.`;
  } else if (asked.includes("why") || asked.includes("explain")) {
    interactiveReply =
      `This allocation is chosen from your inputs, not fixed defaults: duration ${p.durationMonths} months, ROI expectation ${p.expectedRoi}%, and risk direction ${recommendedDirection}. ` +
      `The split ETF ${targetAllocation.ETF}%, FLEXI ${targetAllocation.FLEXI}%, SMALL ${targetAllocation.SMALL}% is designed to keep ROI feasibility realistic while avoiding over-concentration.`;
  }

  return {
    reply: interactiveReply,
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
8. Directly answer the user's latest question in the first 1-2 lines of "reply".
9. Do not repeat boilerplate phrasing from earlier turns.
10. If user asks "why X%", explain using current-vs-target and risk/feasibility logic.
11. Do NOT change allocation for enquiry-only questions.
12. If user explicitly asks to change allocation, treat it as approval and update allocation in the same reply.
13. For explicit change requests, explain what changed and why.

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
  pendingProposal,
}) {
  const baseTargetAllocation = normalizeAllocation(baseRecommendation?.targetAllocation || {});
  const baseDirection = normalizeDirection(baseRecommendation?.recommendedDirection);
  const wantsChange = isExplicitAllocationChangeRequest(userMessage);

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
        format: "json",
        stream: false,
        options: {
          temperature: 0.55,
        },
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
    const fallback = buildFallbackResponse(baseRecommendation, planningContext, userMessage);
    const heuristicTargetAllocation = buildRuleBasedAllocationAdjustment(
      baseTargetAllocation,
      planningContext,
      userMessage
    );
    const applyOnFallback = wantsChange && !allocationsEqual(heuristicTargetAllocation, baseTargetAllocation);
    return {
      ...fallback,
      reply: applyOnFallback
        ? `Updated as requested. New target allocation is ETF ${heuristicTargetAllocation.ETF}%, FLEXI ${heuristicTargetAllocation.FLEXI}%, SMALL ${heuristicTargetAllocation.SMALL}%. ${fallback.reply}`
        : fallback.reply,
      finalRecommendation: {
        ...fallback.finalRecommendation,
        targetAllocation: applyOnFallback
          ? heuristicTargetAllocation
          : fallback.finalRecommendation.targetAllocation,
        summary: applyOnFallback
          ? `Final recommendation updated for your latest request. Target allocation is ETF ${heuristicTargetAllocation.ETF}%, FLEXI ${heuristicTargetAllocation.FLEXI}%, SMALL ${heuristicTargetAllocation.SMALL}%.`
          : fallback.finalRecommendation.summary,
      },
      changeControl: {
        status: applyOnFallback ? "APPLIED" : "NONE",
        approvalRequired: false,
        proposedTargetAllocation: null,
      },
    };
  }

  const fallback = buildFallbackResponse(baseRecommendation, planningContext, userMessage);
  const finalRecommendation = parsed.finalRecommendation || {};
  const p = buildPlanningContext(baseRecommendation, planningContext);
  const modelTargetAllocation = normalizeAllocation(
    finalRecommendation.targetAllocation || fallback.finalRecommendation.targetAllocation
  );
  const heuristicTargetAllocation = buildRuleBasedAllocationAdjustment(
    baseTargetAllocation,
    planningContext,
    userMessage
  );
  const chosenTargetAllocation = wantsChange
    ? allocationsEqual(modelTargetAllocation, baseTargetAllocation)
      ? heuristicTargetAllocation
      : modelTargetAllocation
    : baseTargetAllocation;
  const allocationChanged = !allocationsEqual(chosenTargetAllocation, baseTargetAllocation);
  const replyPrefix =
    wantsChange && allocationChanged
      ? `Updated as requested. New target allocation is ETF ${chosenTargetAllocation.ETF}%, FLEXI ${chosenTargetAllocation.FLEXI}%, SMALL ${chosenTargetAllocation.SMALL}%. `
      : "";

  return {
    reply: `${replyPrefix}${String(parsed.reply || fallback.reply)}`.trim(),
    analysis: {
      roiFeasibility: normalizeRoiFeasibility(
        parsed?.analysis?.roiFeasibility,
        fallback.finalRecommendation.roiFeasibility
      ),
      durationComment: String(parsed?.analysis?.durationComment || ""),
      riskTradeoff: String(parsed?.analysis?.riskTradeoff || ""),
    },
    changeControl: {
      status: wantsChange && allocationChanged ? "APPLIED" : "NONE",
      approvalRequired: false,
      proposedTargetAllocation: null,
    },
    finalRecommendation: {
      recommendedDirection: baseDirection,
      summary: String(finalRecommendation.summary || fallback.finalRecommendation.summary),
      targetAllocation: chosenTargetAllocation,
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
