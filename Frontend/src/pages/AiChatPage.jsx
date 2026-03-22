import { useMemo, useState } from "react";
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

  const sessionId = initialContext?.sessionId || null;
  const planningContext = initialContext?.planningContext || {};

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

      const res = await chatRecommendation({
        baseRecommendation,
        planningContext,
        chatHistory: messages,
        userMessage,
      });

      if (res?.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
      }
      if (res?.analysis) {
        setAnalysis(res.analysis);
      }
      if (res?.finalRecommendation) {
        setFinalRecommendation((prev) => ({ ...prev, ...res.finalRecommendation }));
      }
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Chat request failed");
    } finally {
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
    <div className="fund-details-modal" style={{ maxWidth: 900, margin: "32px auto" }}>
      <div className="fund-details-header">
        <h2>AI Chatbot (Recommendation Follow-up)</h2>
        <button
          className="close-btn"
          onClick={() => navigate(sessionId ? `/portfolio?session_id=${sessionId}` : "/portfolio")}
        >
          ×
        </button>
      </div>

      <div className="ai-card" style={{ marginBottom: 16 }}>
        <div className="ai-card-title">Current Final Recommendation</div>
        <div className="ai-card-text" style={{ marginBottom: 8 }}>
          Context: Duration {planningContext?.durationMonths ?? "-"} months, Expected ROI {planningContext?.expectedRoi ?? "-"}%, Investment Amount ₹{Number(planningContext?.investmentAmount || 0).toLocaleString("en-IN")}
        </div>
        <div className="ai-card-text" style={{ marginBottom: 8 }}>
          Recommended: {String(finalRecommendation?.recommendedDirection || "CONSERVATIVE").toUpperCase()}
        </div>
        <div className="ai-card-text" style={{ marginBottom: 8 }}>
          ROI Feasibility: {String(finalRecommendation?.roiFeasibility || analysis?.roiFeasibility || planningContext?.roiFeasibility || "-")}
        </div>
        <div className="ai-card-text" style={{ marginBottom: 8 }}>
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
          <div className="ai-card-text ai-card-text--mono" style={{ marginTop: 10 }}>
            {finalRecommendation.allocationReasoning}
          </div>
        ) : null}
        {analysis?.durationComment ? (
          <div className="ai-card-text" style={{ marginTop: 8 }}>
            <strong>Duration View:</strong> {analysis.durationComment}
          </div>
        ) : null}
        {analysis?.riskTradeoff ? (
          <div className="ai-card-text" style={{ marginTop: 4 }}>
            <strong>Risk Tradeoff:</strong> {analysis.riskTradeoff}
          </div>
        ) : null}
        {finalRecommendation?.nextSteps?.length ? (
          <div style={{ marginTop: 10 }}>
            <div className="ai-card-title">Action Plan</div>
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

      <div className="ai-card" style={{ marginBottom: 16, minHeight: 260 }}>
        <div className="ai-card-title">Discussion</div>
        <div style={{ maxHeight: 260, overflowY: "auto", paddingRight: 4 }}>
          {messages.map((m, idx) => (
            <div
              key={`${m.role}-${idx}`}
              style={{
                margin: "10px 0",
                padding: "10px 12px",
                borderRadius: 8,
                background: m.role === "assistant" ? "#f3f4f6" : "#dbeafe",
                color: "#111827",
              }}
            >
              <strong style={{ marginRight: 8 }}>{m.role === "assistant" ? "AI" : "You"}:</strong>
              <span>{m.content}</span>
            </div>
          ))}
        </div>

        {error ? <div className="ai-alert ai-alert--error">{error}</div> : null}

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your concern or plan..."
            style={{
              flex: 1,
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "10px 12px",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
          />
          <button
            disabled={loading || !input.trim()}
            onClick={handleSend}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #2563eb",
              background: "#2563eb",
              color: "white",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Thinking..." : "Send"}
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
