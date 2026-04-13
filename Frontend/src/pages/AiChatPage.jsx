import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import { chatRecommendation } from "../services/aiService";
import "../components/PortfolioPage.css";

const CHAT_CONTEXT_KEY = "chai_ai_chat_context";

function readStoredContext() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CHAT_CONTEXT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
}

function formatPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `${Math.round(n)}%`;
}

function formatEnum(value) {
  if (!value) return "-";
  return String(value).replace(/_/g, " ");
}

function AiChatPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const initialContext = useMemo(() => {
    const fromState = location.state || null;
    const fromStore = readStoredContext();
    return fromState?.recommendation ? fromState : fromStore;
  }, [location.state]);

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Share your concerns, constraints, or plans. I will refine the final allocation recommendation before you move to funds.",
      source: "SYSTEM",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [finalRecommendation, setFinalRecommendation] = useState(
    initialContext?.recommendation || null
  );
  const [analysis, setAnalysis] = useState(null);
  const abortControllerRef = useRef(null);

  const sessionId = initialContext?.sessionId || null;
  const planningContext = initialContext?.planningContext || {};

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !initialContext?.recommendation || !finalRecommendation) return;
    sessionStorage.setItem(
      CHAT_CONTEXT_KEY,
      JSON.stringify({
        ...initialContext,
        recommendation: {
          ...initialContext.recommendation,
          ...finalRecommendation,
        },
      })
    );
  }, [finalRecommendation, initialContext]);

  const handleTerminate = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
    setError("");
  };

  const handleSend = async () => {
    const userMessage = input.trim();
    if (!userMessage || !initialContext?.recommendation || loading) return;

    setError("");
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");

    try {
      const baseRecommendation = {
        ...initialContext.recommendation,
        ...(finalRecommendation || {}),
        currentAllocation:
          finalRecommendation?.currentAllocation ||
          initialContext.recommendation?.currentAllocation ||
          {},
      };
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const res = await chatRecommendation({
        baseRecommendation,
        planningContext,
        chatHistory: messages,
        userMessage,
      }, { signal: controller.signal });

      if (res?.reply) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: res.reply,
            source: res?.llm?.status === "SUCCESS" ? "GEMINI" : "RULE_BASED",
            model: res?.llm?.model || "",
          },
        ]);
      }
      if (res?.analysis) {
        setAnalysis(res.analysis);
      }
      if (res?.finalRecommendation) {
        setFinalRecommendation((prev) => ({ ...prev, ...res.finalRecommendation }));
      }
    } catch (e) {
      if (!axios.isCancel(e) && e?.code !== "ERR_CANCELED") {
        setError(e?.response?.data?.error || e?.message || "Chat request failed");
      }
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  if (!initialContext?.recommendation) {
    return (
      <div className="fund-details-modal" style={{ maxWidth: 900, margin: "32px auto" }}>
        <h2>AI Chatbot</h2>
        <p>Recommendation context not found. Please generate recommendation first from the portfolio page.</p>
        <button
          onClick={() => navigate(sessionId ? `/portfolio?session_id=${sessionId}` : "/portfolio")}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #2563eb", background: "#2563eb", color: "#fff" }}
        >
          Back to Portfolio
        </button>
      </div>
    );
  }

  return (
    <div className="fund-details-modal ai-chat-page" style={{ maxWidth: 900, margin: "32px auto" }}>
      <div className="fund-details-header">
        <h2 className="ai-chat-page__title">AI Chatbot (Recommendation Follow-up)</h2>
        <button
          className="close-btn"
          onClick={() => navigate(sessionId ? `/portfolio?session_id=${sessionId}` : "/portfolio")}
        >
          ×
        </button>
      </div>

      <div className="ai-card ai-chat-page__panel" style={{ marginBottom: 16 }}>
        <div className="ai-card-title ai-chat-page__section-title">Current Final Recommendation</div>
        <div className="ai-card-text ai-chat-page__meta" style={{ marginBottom: 8 }}>
          Context: Duration {planningContext?.durationMonths ?? "-"} months, Expected ROI {planningContext?.expectedRoi ?? "-"}%, Investment Amount ₹{Number(planningContext?.investmentAmount || 0).toLocaleString("en-IN")}
        </div>
        <div className="ai-card-text ai-chat-page__status" style={{ marginBottom: 8 }}>
          Recommended: {String(finalRecommendation?.recommendedDirection || "CONSERVATIVE").toUpperCase()}
        </div>
        <div className="ai-card-text ai-chat-page__status" style={{ marginBottom: 8 }}>
          ROI Feasibility: {String(finalRecommendation?.roiFeasibility || analysis?.roiFeasibility || planningContext?.roiFeasibility || "-")}
        </div>
        <div className="ai-card-text ai-chat-page__summary" style={{ marginBottom: 8 }}>
          {finalRecommendation?.summary || "-"}
        </div>
        {finalRecommendation?.portfolioRiskView ? (
          <div style={{ marginTop: 10 }}>
            <div className="ai-card-title ai-chat-page__section-title">Verified Risk Snapshot</div>
            <div className="ai-card-text ai-chat-page__body">
              Overall weighted risk score: <strong>{Number(finalRecommendation?.weightedAverageRiskScore || 0).toFixed(2)} / 6</strong>
            </div>
            <div className="ai-card-text ai-chat-page__body">
              Overall verified risk: <strong>{formatEnum(finalRecommendation?.portfolioRiskView?.overallRiskLevel)}</strong>
            </div>
            <div className="ai-card-text ai-chat-page__body">
              Dominant risk bucket: <strong>{formatEnum(finalRecommendation?.portfolioRiskView?.dominantRiskLevel)}</strong>
            </div>
            <div className="ai-card-text ai-chat-page__body">
              Verified by value: <strong>{formatPct(finalRecommendation?.portfolioRiskView?.officialCoverageByValuePct)}</strong>
            </div>
          </div>
        ) : null}
        {finalRecommendation?.currentAllocation ? (
          <div style={{ marginTop: 10 }}>
            <div className="ai-card-title ai-chat-page__section-title">Current Category Exposure</div>
            <div className="ai-table-wrap">
              <table className="ai-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Exposure</th>
                  </tr>
                </thead>
                <tbody>
                  {["ETF", "FLEXI", "SMALL", "OTHER"].map((key) => (
                    <tr key={key}>
                      <td className="ai-td-key">{key}</td>
                      <td>{formatPct(finalRecommendation?.currentAllocation?.[key])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {finalRecommendation?.newInvestmentPlan?.categories?.length ? (
          <div style={{ marginTop: 10 }}>
            <div className="ai-card-title ai-chat-page__section-title">Fresh Money Advisory</div>
            {finalRecommendation?.newInvestmentPlan?.note ? (
              <div className="ai-card-text ai-chat-page__body" style={{ marginBottom: 8 }}>
                {finalRecommendation.newInvestmentPlan.note}
              </div>
            ) : null}
            <div className="ai-table-wrap">
              <table className="ai-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Guidance</th>
                  </tr>
                </thead>
                <tbody>
                  {finalRecommendation.newInvestmentPlan.categories.map((item) => (
                    <tr key={item.category}>
                      <td className="ai-td-key">{item.category}</td>
                      <td>{item.priority}</td>
                      <td>{item.guidance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {finalRecommendation?.schemeRiskExposure ? (
          <div style={{ marginTop: 10 }}>
            <div className="ai-card-title ai-chat-page__section-title">Scheme Risk Exposure</div>
            <div className="ai-table-wrap">
              <table className="ai-table">
                <thead>
                  <tr>
                    <th>Risk Bucket</th>
                    <th>Exposure</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(finalRecommendation?.schemeRiskExposure || {})
                    .filter(([, value]) => Number(value) > 0)
                    .map(([label, value]) => (
                      <tr key={label}>
                        <td className="ai-td-key">{formatEnum(label)}</td>
                        <td>{formatPct(value)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {finalRecommendation?.reasoning ? (
          <div className="ai-card-text ai-card-text--mono ai-chat-page__body" style={{ marginTop: 10 }}>
            {finalRecommendation.reasoning}
          </div>
        ) : null}
        {finalRecommendation?.riskProfileExplanation ? (
          <div className="ai-card-text ai-card-text--mono ai-chat-page__body" style={{ marginTop: 8 }}>
            <strong>Risk Profile Logic:</strong> {finalRecommendation.riskProfileExplanation}
          </div>
        ) : null}
        {analysis?.durationComment ? (
          <div className="ai-card-text ai-chat-page__body" style={{ marginTop: 8 }}>
            <strong>Duration View:</strong> {analysis.durationComment}
          </div>
        ) : null}
        {analysis?.riskTradeoff ? (
          <div className="ai-card-text ai-chat-page__body" style={{ marginTop: 4 }}>
            <strong>Risk Tradeoff:</strong> {analysis.riskTradeoff}
          </div>
        ) : null}
        {finalRecommendation?.concentrationFlags?.length ? (
          <div style={{ marginTop: 10 }}>
            <div className="ai-card-title ai-chat-page__section-title">Concentration Checks</div>
            <ol className="ai-steps">
              {finalRecommendation.concentrationFlags.map((step, idx) => (
                <li key={`flag-${idx}`} className="ai-step">
                  {step}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {finalRecommendation?.adviceForNewInvestment?.length ? (
          <div style={{ marginTop: 10 }}>
            <div className="ai-card-title ai-chat-page__section-title">Fresh Investment Approach</div>
            <ol className="ai-steps">
              {finalRecommendation.adviceForNewInvestment.map((step, idx) => (
                <li key={`advice-${idx}`} className="ai-step">
                  {step}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {finalRecommendation?.nextSteps?.length ? (
          <div style={{ marginTop: 10 }}>
            <div className="ai-card-title ai-chat-page__section-title">Action Plan</div>
            <ol className="ai-steps">
              {finalRecommendation.nextSteps.map((step, idx) => (
                <li key={`step-${idx}`} className="ai-step">
                  {step}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>

      <div className="ai-card ai-chat-page__panel" style={{ marginBottom: 16, minHeight: 260 }}>
        <div className="ai-card-title ai-chat-page__section-title">Discussion</div>
        <div style={{ maxHeight: 260, overflowY: "auto", paddingRight: 4 }}>
          {messages.map((m, idx) => (
            <div
              className={`ai-chat-bubble ${m.role === "assistant" ? "ai-chat-bubble--assistant" : "ai-chat-bubble--user"}`}
              key={`${m.role}-${idx}`}
            >
              <strong className="ai-chat-bubble__label">{m.role === "assistant" ? "AI" : "You"}:</strong>
              <span className="ai-chat-bubble__content">{m.content}</span>
              {m.role === "assistant" && m.source ? (
                <div style={{ marginTop: 6, fontSize: 11, color: "#6b7280" }}>
                  {m.source === "GEMINI"
                    ? `Source: Gemini${m.model ? ` (${m.model})` : ""}`
                    : m.source === "RULE_BASED"
                      ? "Source: Rule-based fallback"
                      : "Source: System"}
                </div>
              ) : null}
            </div>
          ))}
          {loading ? (
            <div className="ai-chat-bubble ai-chat-bubble--assistant">
              <strong className="ai-chat-bubble__label">AI:</strong>
              <span className="ai-thinking" aria-label="Model is thinking">
                <span className="ai-thinking-dot" />
                <span className="ai-thinking-dot" />
                <span className="ai-thinking-dot" />
              </span>
            </div>
          ) : null}
        </div>

        {error ? <div className="ai-alert ai-alert--error">{error}</div> : null}

        <div className="ai-chat-page__composer" style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input
            className="ai-chat-page__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your concern or plan..."
            disabled={loading}
            style={{
              flex: 1,
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "10px 12px",
              opacity: loading ? 0.65 : 1,
              cursor: loading ? "not-allowed" : "text",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
          />
          <button
            className="ai-chat-page__send"
            disabled={!loading && !input.trim()}
            onClick={loading ? handleTerminate : handleSend}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: loading ? "1px solid #dc2626" : "1px solid #2563eb",
              background: loading ? "#fff1f2" : "#2563eb",
              minWidth: 96,
              color: loading ? "#b91c1c" : "white",
              cursor: !loading && !input.trim() ? "not-allowed" : "pointer",
            }}
            aria-label={loading ? "Terminate request" : "Send message"}
          >
            {loading ? (
              <span className="ai-stop-control">
                <span className="ai-stop-icon">
                  <span className="ai-stop-square" />
                </span>
                <span className="ai-stop-label">Terminate</span>
              </span>
            ) : (
              "Send"
            )}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => navigate("/news")}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid #3b82f6",
            background: "#3b82f6",
            color: "white",
            cursor: "pointer",
            fontWeight: "600"
          }}
        >
          Get Updates
        </button>
      </div>
    </div>
  );
}

export default AiChatPage;
