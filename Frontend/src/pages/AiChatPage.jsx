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
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [finalRecommendation, setFinalRecommendation] = useState(
    initialContext?.recommendation || null
  );
  const [analysis, setAnalysis] = useState(null);
  const [pendingProposal, setPendingProposal] = useState(null);
  const abortControllerRef = useRef(null);

  const sessionId = initialContext?.sessionId || null;
  const planningContext = initialContext?.planningContext || {};

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

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
        pendingProposal,
      }, { signal: controller.signal });

      if (res?.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
      }
      if (res?.analysis) {
        setAnalysis(res.analysis);
      }
      if (res?.changeControl) {
        setPendingProposal(res.changeControl.proposedTargetAllocation || null);
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
        <div className="ai-table-wrap">
          <table className="ai-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {["ETF", "FLEXI", "SMALL"].map((k) => (
                <tr key={k}>
                  <td className="ai-td-key">{k}</td>
                  <td>{formatPct(finalRecommendation?.targetAllocation?.[k])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {finalRecommendation?.allocationReasoning ? (
          <div className="ai-card-text ai-card-text--mono ai-chat-page__body" style={{ marginTop: 10 }}>
            {finalRecommendation.allocationReasoning}
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
        {pendingProposal ? (
          <div className="ai-alert" style={{ marginTop: 10, background: "#fef9c3", border: "1px solid #fde68a", color: "#854d0e" }}>
            Proposed change pending approval: ETF {pendingProposal.ETF}% / FLEXI {pendingProposal.FLEXI}% / SMALL {pendingProposal.SMALL}%. Reply with
            {" "}
            <strong>yes, apply</strong>
            {" "}
            to confirm.
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
          onClick={() => navigate(sessionId ? `/portfolio?session_id=${sessionId}` : "/portfolio")}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid #16a34a",
            background: "#16a34a",
            color: "white",
            cursor: "pointer",
          }}
        >
          Show Me Funds
        </button>
      </div>
    </div>
  );
}

export default AiChatPage;
