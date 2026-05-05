function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || "";
}

function getGeminiApiKeys() {
  return [
    process.env.GEMINI_API_KEY || "",
    process.env.GEMINI_API_KEY_2 || "",
    process.env.GEMINI_API_KEY_FALLBACK || "",
  ].filter((value, index, list) => value && list.indexOf(value) === index);
}

function getGeminiModel() {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
}

function getGeminiTimeoutMs() {
  return Number(process.env.GEMINI_TIMEOUT_MS) || 25000;
}

function getGeminiRiskometerMaxOutputTokens() {
  return Number(process.env.GEMINI_RISKOMETER_MAX_OUTPUT_TOKENS) || 1600;
}

const VALID_RISK_LABELS = new Set([
  "LOW",
  "LOW_TO_MODERATE",
  "MODERATE",
  "MODERATELY_HIGH",
  "HIGH",
  "VERY_HIGH",
]);

function stringifyJson(value) {
  return JSON.stringify(value, null, 2);
}

function buildRiskScaleLegend() {
  return [
    "1 = LOW",
    "2 = LOW TO MODERATE",
    "3 = MODERATE",
    "4 = MODERATELY HIGH",
    "5 = HIGH",
    "6 = VERY HIGH",
  ].join(", ");
}

function extractJsonObject(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || raw;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      let depth = 0;
      let inString = false;
      let escaped = false;

      for (let index = start; index < candidate.length; index += 1) {
        const char = candidate[index];

        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === "\\") {
          escaped = true;
          continue;
        }
        if (char === "\"") {
          inString = !inString;
          continue;
        }
        if (inString) continue;

        if (char === "{") depth += 1;
        if (char === "}") depth -= 1;

        if (depth === 0) {
          try {
            return JSON.parse(candidate.slice(start, index + 1));
          } catch {
            return null;
          }
        }
      }
      return null;
    }
  }
}

function normalizeParsedRiskometerCandidates(parsed) {
  if (Array.isArray(parsed)) return parsed.filter((entry) => entry && typeof entry === "object");
  if (parsed && typeof parsed === "object") return [parsed];
  return [];
}

function getGeminiText(payload = {}) {
  return (payload?.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => part?.text || "")
    .join("\n")
    .trim();
}

function getGroundingUrls(payload = {}) {
  const urls = new Set();

  for (const candidate of payload?.candidates || []) {
    for (const chunk of candidate?.groundingMetadata?.groundingChunks || []) {
      const uri = chunk?.web?.uri;
      if (uri) urls.add(String(uri));
    }
  }

  return [...urls];
}

async function callGeminiWithRetry(fn, maxRetries = 3, initialDelay = 2000) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isRateLimit = String(error.message).includes("429");
      if (isRateLimit && attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(`Gemini rate limit hit (429). Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

async function callGeminiJson({
  prompt,
  system = "",
  useSearch = false,
  temperature = 0.2,
  maxOutputTokens = 512,
}) {
  const apiKeys = getGeminiApiKeys();
  const model = getGeminiModel();

  if (!apiKeys.length) {
    throw new Error("GEMINI_API_KEY is missing.");
  }

  const performCall = async () => {
    let lastError;
    for (const apiKey of apiKeys) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), getGeminiTimeoutMs());

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: system
              ? {
                  parts: [{ text: system }],
                }
              : undefined,
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }],
              },
            ],
            tools: useSearch ? [{ google_search: {} }] : undefined,
            generationConfig: {
              temperature,
              maxOutputTokens,
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          const status = response.status;
          const error = new Error(`Gemini returned ${status} ${response.statusText}. ${errorText.slice(0, 300)}`);
          if (status === 429) {
            lastError = error;
            continue;
          }
          throw error;
        }

        const payload = await response.json();
        const text = getGeminiText(payload);
        const parsed = extractJsonObject(text);

        if (!parsed || typeof parsed !== "object") {
          throw new Error("Gemini returned non-JSON content.");
        }

        return {
          parsed,
          groundingUrls: getGroundingUrls(payload),
          rawText: text,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastError || new Error("Gemini request failed.");
  };

  return callGeminiWithRetry(performCall);
}

function sanitizeList(values, fallback = []) {
  if (!Array.isArray(values)) return fallback;
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

function normalizeDirection(value, fallback = "CONSERVATIVE") {
  const v = String(value || "").toUpperCase();
  if (v === "AGGRESSIVE" || v === "BALANCED" || v === "CONSERVATIVE") return v;
  return fallback;
}

function normalizeRiskLabel(value) {
  const raw = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (VALID_RISK_LABELS.has(raw)) return raw;
  return "UNKNOWN";
}

function isThirdPartyFallbackSourceUrl(url = "") {
  const raw = String(url || "").trim().toLowerCase();
  if (!raw) return false;

  try {
    const host = new URL(raw).hostname.replace(/^www\./, "");
    const allowedDomains = [
      "moneycontrol.com",
      "groww.in",
    ];

    return allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function getThirdPartySourceName(url = "") {
  const raw = String(url || "").trim().toLowerCase();

  try {
    const host = new URL(raw).hostname.replace(/^www\./, "");
    if (host === "moneycontrol.com" || host.endsWith(".moneycontrol.com")) return "MONEYCONTROL";
    if (host === "groww.in" || host.endsWith(".groww.in")) return "GROWW";
  } catch {
    // Fall through.
  }

  return "THIRD_PARTY";
}

const THIRD_PARTY_RISKOMETER_SOURCES = [
  {
    key: "MONEYCONTROL",
    label: "Moneycontrol",
    domains: ["moneycontrol.com"],
  },
  {
    key: "GROWW",
    label: "Groww",
    domains: ["groww.in"],
  },
];

function isSpecificThirdPartySourceUrl(url = "", source = {}) {
  const raw = String(url || "").trim().toLowerCase();
  if (!raw || !Array.isArray(source.domains)) return false;

  try {
    const host = new URL(raw).hostname.replace(/^www\./, "");
    return source.domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function tokenizeForUrlMatch(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function scoreSourceUrlForFund(url = "", fund = {}) {
  const raw = String(url || "").toLowerCase();
  if (!raw) return -1;

  let score = 0;
  const amfiCode = String(fund?.amfiCode || "").trim();
  if (amfiCode && raw.includes(amfiCode.toLowerCase())) score += 6;

  const schemeTokens = tokenizeForUrlMatch(fund?.schemeName);
  for (const token of schemeTokens) {
    if (raw.includes(token)) score += 1;
  }

  if (raw.includes("moneycontrol.com")) score += 2;
  if (raw.includes("/mutual-funds/")) score += 2;
  if (raw.includes("/nav/")) score += 1;

  return score;
}

async function verifyReachableSourceUrl(url = "") {
  const raw = String(url || "").trim();
  if (!raw || !isThirdPartyFallbackSourceUrl(raw)) return "";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(raw, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FineRcom/1.0)",
      },
    });

    if (!response.ok) return "";
    return String(response.url || raw).trim();
  } catch {
    return "";
  } finally {
    clearTimeout(timeoutId);
  }
}

async function resolveTrustedSourceUrl({
  candidateUrl = "",
  groundingUrls = [],
  fund = {},
}) {
  const rankedUrls = [...new Set(
    [candidateUrl, ...(Array.isArray(groundingUrls) ? groundingUrls : [])]
      .map((url) => String(url || "").trim())
      .filter((url) => isThirdPartyFallbackSourceUrl(url))
  )]
    .map((url) => ({ url, score: scoreSourceUrlForFund(url, fund) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.url);

  for (const url of rankedUrls) {
    const verifiedUrl = await verifyReachableSourceUrl(url);
    if (verifiedUrl) return verifiedUrl;
  }

  return "";
}

function buildInitialPrompt({ analysisResult }) {
  const aiEvaluation = analysisResult?.aiEvaluation || {};
  const riskScore = aiEvaluation?.riskScore || {};
  const riskView = aiEvaluation?.portfolioRiskView || {};
  const goalAssessment = aiEvaluation?.goalAssessment || {};

  return `
You are helping an Indian mutual fund investor decide how to direct a new investment.

Important:
- The structured portfolio analysis below is the source of truth.
- Risk profile must be explained using this 1-6 scale only: ${buildRiskScaleLegend()}.
- Official Risk-o-meter values and analytics-derived volatility/drawdown metrics are both useful, but do not call derived analytics an official Risk-o-meter.
- Do not invent funds, returns, or allocations.
- Give practical fresh-investment guidance, not generic financial education.
- Avoid exact percentage target allocations and fixed category splits.
- Do not guarantee returns and do not present this as certified financial advice.
- Keep the language clear and natural for a retail investor.
- Sound like a thoughtful advisor, not a terse template.
- Explain the main risk and diversification tradeoff in plain language.

Return valid JSON only with this shape:
{
  "summary": "string",
  "reasoning": "string",
  "adviceForNewInvestment": ["string"],
  "nextSteps": ["string"]
}

Response style:
- "summary" may be 2 to 3 sentences.
- "reasoning" should usually be 4 to 5 lines of natural explanation.
- "adviceForNewInvestment" must be crisp action points, not paragraphs.
- Focus on exactly how the new money should be invested based on official risk labels, derived analytics, and concentration.
- Avoid robotic phrasing and repeated sentence openings.

Structured portfolio analysis:
${stringifyJson({
    inputs: analysisResult?.inputs || {},
    recommendedDirection: aiEvaluation?.recommendedDirection || analysisResult?.recommendedDirection || "CONSERVATIVE",
    diversificationStatus: aiEvaluation?.diversificationStatus || "",
    weightedAverageRiskScore: riskScore?.weightedAverageRiskScore || 0,
    overallRiskLevel: riskView?.overallRiskLevel || "UNKNOWN",
    dominantRiskLevel: riskView?.dominantRiskLevel || "UNKNOWN",
    riskCoverageByValuePct: riskView?.officialCoverageByValuePct || 0,
    riskCoverageBySchemePct: riskView?.officialCoverageBySchemePct || 0,
    currentAllocation: aiEvaluation?.currentAllocation || {},
    schemeRiskExposure: aiEvaluation?.schemeRiskExposure || {},
    topHoldings: aiEvaluation?.topHoldings || [],
    verifiedFunds: aiEvaluation?.verifiedFunds || [],
    unverifiedFunds: aiEvaluation?.unverifiedFunds || [],
    concentrationFlags: aiEvaluation?.concentrationFlags || [],
    existingAdvice: aiEvaluation?.adviceForNewInvestment || [],
    newInvestmentPlan: aiEvaluation?.newInvestmentPlan || {},
    goalAssessment,
    reasoning: aiEvaluation?.detailedExplanation || {},
  })}
`.trim();
}

function buildChatPrompt({
  baseRecommendation = {},
  planningContext = {},
  userMessage = "",
  chatHistory = [],
  fallbackReply = "",
  fallbackNextSteps = [],
  fallbackAnalysis = {},
}) {
  return `
You are refining mutual-fund fresh-investment guidance for an investor in India.

Important:
- The structured recommendation context is the source of truth.
- Risk must be explained using this 1-6 scale only: ${buildRiskScaleLegend()}.
- Distinguish official Risk-o-meter labels from analytics-derived volatility/drawdown observations.
- Do not invent portfolio data, source URLs, exact returns, or guaranteed outcomes.
- Respond to the user's latest message directly and practically.
- Keep the recommendation aligned with the user's horizon, expected ROI, concentration risks, and current risk profile.
- You may refine the recommended direction only if the user's message justifies it.
- Do not produce rigid percentage allocation advice unless the user explicitly asks for that format.
- Sound like a thoughtful portfolio guide, not a template.
- When useful, compare two sensible options briefly and explain the tradeoff in plain language.
- Tie the answer back to the user's actual portfolio context rather than giving generic finance advice.

Return valid JSON only with this shape:
{
  "reply": "string",
  "reasoning": "string",
  "recommendedDirection": "CONSERVATIVE | BALANCED | AGGRESSIVE",
  "nextSteps": ["string"]
}

Response style:
- "reply" should usually be 3 to 5 sentences, natural and investor-friendly.
- "reasoning" should explain the tradeoff in plain language and may be 2 to 4 sentences.
- "nextSteps" should be concrete action points, not long explanations.
- Avoid robotic phrasing and repeated sentence openings.
- If the user asks for comparison, answer in comparison form instead of flattening it into one generic sentence.

Structured recommendation context:
${stringifyJson({
    planningContext,
    summary: baseRecommendation?.summary || "",
    recommendedDirection: baseRecommendation?.recommendedDirection || "CONSERVATIVE",
    diversificationStatus: baseRecommendation?.diversificationStatus || "",
    portfolioRiskView: baseRecommendation?.portfolioRiskView || {},
    currentAllocation: baseRecommendation?.currentAllocation || {},
    categoryExposure: baseRecommendation?.categoryExposure || {},
    schemeRiskExposure: baseRecommendation?.schemeRiskExposure || {},
    verifiedFunds: baseRecommendation?.verifiedFunds || [],
    unverifiedFunds: baseRecommendation?.unverifiedFunds || [],
    newInvestmentPlan: baseRecommendation?.newInvestmentPlan || {},
    concentrationFlags: baseRecommendation?.concentrationFlags || [],
    topHoldings: baseRecommendation?.topHoldings || [],
    adviceForNewInvestment: baseRecommendation?.adviceForNewInvestment || [],
    reasoning: baseRecommendation?.reasoning || "",
    fallbackReply,
    fallbackAnalysis,
    recentChatHistory: chatHistory.slice(-6),
    userMessage,
    fallbackNextSteps,
  })}
`.trim();
}

const INITIAL_SYSTEM_PROMPT =
  "You are an investment guidance assistant. Use the supplied portfolio analysis only. Be practical, grounded, and concise. Output JSON only.";

const CHAT_SYSTEM_PROMPT =
  "You are an investment guidance assistant for follow-up portfolio questions. Respect the supplied recommendation context, explain risk in plain language when relevant, and output JSON only.";

const RISKOMETER_SYSTEM_PROMPT =
  "You extract Indian mutual fund Risk-o-meter values from approved third-party sources. Use Google Search grounding and output JSON only.";

export async function generateInitialRecommendationWithGemini({ analysisResult }) {
  const payload = buildInitialPrompt({ analysisResult });

  const { parsed } = await callGeminiJson({
    prompt: payload,
    system: INITIAL_SYSTEM_PROMPT,
    maxOutputTokens: 640,
  });

  const result = {
    summary: String(parsed?.summary || "").trim(),
    reasoning: String(parsed?.reasoning || "").trim(),
    adviceForNewInvestment: sanitizeList(parsed?.adviceForNewInvestment),
    nextSteps: sanitizeList(parsed?.nextSteps),
    model: getGeminiModel(),
  };

  return result;
}

export async function generateChatRecommendationWithGemini({
  baseRecommendation,
  planningContext,
  chatHistory,
  userMessage,
  fallbackReply,
  fallbackNextSteps,
  fallbackAnalysis,
}) {
  const { parsed } = await callGeminiJson({
    prompt: buildChatPrompt({
      baseRecommendation,
      planningContext,
      chatHistory,
      userMessage,
      fallbackReply,
      fallbackNextSteps,
      fallbackAnalysis,
    }),
    system: CHAT_SYSTEM_PROMPT,
    maxOutputTokens: 512,
  });

  const fallbackDirection = normalizeDirection(baseRecommendation?.recommendedDirection, "CONSERVATIVE");

  return {
    reply: String(parsed?.reply || "").trim(),
    reasoning: String(parsed?.reasoning || "").trim(),
    recommendedDirection: normalizeDirection(parsed?.recommendedDirection, fallbackDirection),
    nextSteps: sanitizeList(parsed?.nextSteps, fallbackNextSteps),
    model: getGeminiModel(),
  };
}

export async function lookupOfficialRiskometerWithGemini({
  schemeName = "",
  amfiCode = "",
  fundHouse = "",
  category = "",
}) {
  const results = await lookupOfficialRiskometersWithGemini([
    { schemeName, amfiCode, fundHouse, category },
  ]);
  return results[0] || null;
}

export async function lookupOfficialRiskometersWithGemini(funds = []) {
  const normalizedFunds = (Array.isArray(funds) ? funds : [])
    .map((fund, index) => ({
      requestIndex: index,
      schemeName: String(fund?.schemeName || "").trim(),
      amfiCode: String(fund?.amfiCode || "").trim(),
      fundHouse: String(fund?.fundHouse || "").trim(),
      category: String(fund?.category || "").trim(),
    }))
    .filter((fund) => fund.schemeName);

  if (!normalizedFunds.length) {
    return [];
  }

  const resultMap = new Map(
    normalizedFunds.map((fund) => [
      fund.requestIndex,
      {
        schemeName: fund.schemeName,
        amfiCode: fund.amfiCode,
        riskLabel: "UNKNOWN",
        sourceName: "",
        sourceUrl: "",
        asOfDateText: "",
        verified: false,
        lookupStatus: "NOT_FOUND",
      },
    ])
  );

  const buildBatchRiskometerPrompt = ({ batchFunds }) => `
Find the latest Risk-o-meter for each Indian mutual fund below and return ONE JSON ARRAY only.

You may use any reliable Indian mutual fund platform (e.g., Moneycontrol, Value Research, Groww, ET Money, AMFI, or AMC websites).
If no official riskometer is found, return verified=false and riskometer=null.

Allowed riskometer values: Low, Low to Moderate, Moderate, Moderately High, High, Very High.
Do not omit any fund. Do not return markdown, prose, or comments.

Funds:
${stringifyJson(batchFunds.map((fund) => ({
    requestIndex: fund.requestIndex,
    schemeName: fund.schemeName,
    amfiCode: fund.amfiCode || "unknown",
    fundHouse: fund.fundHouse || "unknown",
    category: fund.category || "unknown",
  })))}

Return exactly this JSON array shape:
[
  {
    "requestIndex": 0,
    "schemeName": "string",
    "amfiCode": "string",
    "riskometer": "Low | Low to Moderate | Moderate | Moderately High | High | Very High | null",
    "asOfDateOrMonth": "string | null",
    "sourceUrl": "string | null",
    "sourceType": "string | null",
    "verified": true
  }
]
`.trim();

  let hadSuccessfulLookup = false;
  let pendingFunds = [...normalizedFunds];
  
  try {
    const { parsed, groundingUrls } = await callGeminiJson({
      prompt: buildBatchRiskometerPrompt({ batchFunds: pendingFunds }),
      system: RISKOMETER_SYSTEM_PROMPT,
      useSearch: true,
      temperature: 0,
      maxOutputTokens: Math.max(getGeminiRiskometerMaxOutputTokens(), pendingFunds.length * 220),
    });
    hadSuccessfulLookup = true;

    const candidates = normalizeParsedRiskometerCandidates(parsed);

    for (const candidate of candidates) {
      const requestIndex = Number(candidate?.requestIndex);
      if (!Number.isInteger(requestIndex) || !resultMap.has(requestIndex)) continue;

      const riskLabel = normalizeRiskLabel(candidate?.riskometer);
      const trustedSourceUrl = String(candidate?.sourceUrl || "").trim();
      const verified = riskLabel !== "UNKNOWN" && candidate?.verified === true;

      if (!verified) continue;

      resultMap.set(requestIndex, {
        schemeName: String(candidate?.schemeName || resultMap.get(requestIndex)?.schemeName || "").trim(),
        amfiCode: String(candidate?.amfiCode || resultMap.get(requestIndex)?.amfiCode || "").trim(),
        riskLabel,
        sourceName: String(candidate?.sourceType || "GEMINI_SEARCH").toUpperCase(),
        sourceUrl: trustedSourceUrl,
        asOfDateText: String(candidate?.asOfDateOrMonth || "").trim(),
        verified: true,
        lookupStatus: trustedSourceUrl ? "FOUND" : "FOUND_NO_URL",
      });
    }
  } catch (err) {
    console.error("Gemini batch lookup failed:", err);
  }

  return normalizedFunds
    .sort((a, b) => a.requestIndex - b.requestIndex)
    .map((fund) => {
      const result = resultMap.get(fund.requestIndex);
      if (!hadSuccessfulLookup && !result?.verified) {
        return {
          ...result,
          lookupStatus: "LOOKUP_ERROR",
        };
      }
      return result;
    });
}

export function buildRiskProfileNarrative(aiEvaluation = {}) {
  const weightedScore = Number(aiEvaluation?.riskScore?.weightedAverageRiskScore) || 0;
  const riskLevel = String(aiEvaluation?.portfolioRiskView?.overallRiskLevel || "UNKNOWN").replace(/_/g, " ");
  const dominantRisk = String(aiEvaluation?.portfolioRiskView?.dominantRiskLevel || "UNKNOWN").replace(/_/g, " ");
  const coveragePct = Math.round(Number(aiEvaluation?.portfolioRiskView?.officialCoverageByValuePct) || 0);

  return `The portfolio's current risk profile is explained on a 1-6 scale where ${buildRiskScaleLegend()}. Based on the verified holdings, the weighted average risk score is ${weightedScore || 0}, which maps to ${riskLevel}. The dominant disclosed risk bucket is ${dominantRisk}, and about ${coveragePct}% of current portfolio value is covered by official scheme-level risk data.`;
}
