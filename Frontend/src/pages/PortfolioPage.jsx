import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import UserInputSummary from "../components/UserInputSummary.PortfolioPage";
import AllocationPieChart from "../components/AllocationPieChart.PortfolioPage";
import CategoryButtons from "../components/Categorybuttons.PortfolioPage";
import FundTable from "../components/Fundtable.PortfolioPage";
import FundDetails from "../components/Funddetails.PortfolioPage";
import { getUserInput, getPortfolio } from "../services/PortfolioService.PortfolioPage";
import { getFundDetails } from "../services/fundService.PortfolioPage";
import { evaluateChoice } from "../services/aiService.js";
import "../components/PortfolioPage.css";

const SESSION_KEY = "chai_portfolio_session_id";
const CHAT_CONTEXT_KEY = "chai_ai_chat_context";

function PortfolioPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionIdFromUrl = searchParams.get("session_id");
  const sessionIdFromStorage = typeof window !== "undefined" ? localStorage.getItem(SESSION_KEY) : null;
  const sessionId = sessionIdFromUrl || sessionIdFromStorage;

  const [userInput, setUserInput] = useState(null);
  const [allocationData, setAllocationData] = useState([]);
  const [funds, setFunds] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedFund, setSelectedFund] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  const openAiChatbot = () => {
    if (!aiResult?.aiEvaluation) return;
    const planningContext = {
      durationMonths:
        aiResult?.inputs?.durationMonths ?? Number(userInput?.duration_months) ?? 0,
      expectedRoi:
        aiResult?.inputs?.expectedRoi ?? Number(userInput?.expected_roi) ?? 0,
      investmentAmount:
        aiResult?.inputs?.investmentAmount ?? Number(userInput?.investable_amount) ?? 0,
      roiFeasibility: aiResult?.aiEvaluation?.goalAssessment?.roiFeasibility || "",
    };
    const context = {
      recommendation: aiResult.aiEvaluation,
      planningContext,
      sessionId,
    };
    if (typeof window !== "undefined") {
      sessionStorage.setItem(CHAT_CONTEXT_KEY, JSON.stringify(context));
    }
    navigate("/ai-chat", { state: context });
  };

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    async function fetchData() {
      try {
        const inputRes = await getUserInput(sessionId);
        const portfolioRes = await getPortfolio(sessionId);
        if (cancelled) return;

        const fundsData = portfolioRes.data ?? [];
        const inputData = inputRes.data ?? null;

        setUserInput(inputData);
        setFunds(fundsData);

        const totals = { ETF: 0, FLEXI: 0, SMALL: 0, OTHER: 0 };
        let grandTotal = 0;
        for (const fund of fundsData) {
          const value = Number(fund.current_value) || 0;
          grandTotal += value;
          if (fund.category === "ETF") totals.ETF += value;
          else if (fund.category === "FLEXI") totals.FLEXI += value;
          else if (fund.category === "SMALL") totals.SMALL += value;
          else if (fund.category === "OTHER") totals.OTHER += value;
        }

        setAllocationData([
          { name: "Small Cap", value: grandTotal > 0 ? (totals.SMALL / grandTotal) * 100 : 0 },
          { name: "Flexi Cap", value: grandTotal > 0 ? (totals.FLEXI / grandTotal) * 100 : 0 },
          { name: "ETF", value: grandTotal > 0 ? (totals.ETF / grandTotal) * 100 : 0 },
          { name: "Other", value: grandTotal > 0 ? (totals.OTHER / grandTotal) * 100 : 0 }
        ]);
      } catch (error) {
        if (!cancelled) console.error("Error fetching data:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [sessionId]);

  // ---- Filter Funds By Category ----
  const filteredFunds =
    selectedCategory === "ALL"
      ? funds
      : funds.filter((fund) => fund.category === selectedCategory);

  // ---- Handle Fund Click ----
  const handleFundClick = async (fund) => {
    try {
      setSelectedFund(fund);

      if (!fund.amfi_code || fund.amfi_code === "NOT_FOUND") {
        console.warn("Fund missing AMFI code:", fund.scheme_name);
        return;
      }

      const response = await getFundDetails(fund.amfi_code);
      setLiveData(response.data);

    } catch (error) {
      console.error("Error fetching fund details:", error);
      setLiveData(null);
    }

  };

// ---- Calculate Total Portfolio Value ----
const totalPortfolioValue = funds.reduce((sum, fund) => {
  return sum + (Number(fund.current_value) || 0);
}, 0);
// ---- Animated Counter State ----
const [animatedTotal, setAnimatedTotal] = useState(0);

useEffect(() => {
  
  const duration = 2000; // 2 seconds
  const startTime = performance.now();

  const animate = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const value = progress * totalPortfolioValue;
    setAnimatedTotal(value);

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  if (totalPortfolioValue > 0) {

    requestAnimationFrame(animate);
  }

}, [totalPortfolioValue]);

  if (!sessionId) {
    return (
      <div style={{ textAlign: "center" }}>
        <h2>No session found</h2>
        <p>Please go to the Input page, upload your CAS PDF and submit to view your portfolio.</p>
        <a href="/input">Go to Input page</a>
      </div>
    );
  }

  if (loading) {
    return <h2 style={{ textAlign: "center" }}>Loading Portfolio...</h2>;
  }

  return (
    <>
    {/* User Total Value of Funds */}
      <div className="total-portfolio">
  <h2>Total Portfolio Value : </h2>
 <h1>₹ {animatedTotal.toLocaleString("en-IN")}</h1> 

</div>

      {/* AI Recommendation Trigger */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <button
          onClick={() => setShowAiModal(true)}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid #2563eb",
            background: "#2563eb",
            color: "white",
            cursor: "pointer"
          }}
        >
          Show AI Recommendation
        </button>
      </div>

      {/* User Input Summary */}
      {userInput && <UserInputSummary data={userInput} />}

      {/* Chart + Buttons Section */}
      <div className="chart-section">
        <AllocationPieChart data={allocationData} />
        <CategoryButtons
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />
      </div>




      {/* Fund Table */}
      <FundTable
        funds={filteredFunds}
        onFundClick={handleFundClick}
      />

      {/* Fund Details Modal */}
      {selectedFund && (
        <FundDetails
          fund={selectedFund}
          liveData={liveData}
          onClose={() => {
            setSelectedFund(null);
            setLiveData(null);
          }}
        />
      )}

      {/* AI Choice Modal */}
      {showAiModal && (
        <div className="fund-details-overlay">
          <div className="fund-details-modal" style={{ maxWidth: 700 }}>
            <div className="fund-details-header">
              <h2>AI Recommendation (Based on Your Inputs)</h2>
              <button className="close-btn" onClick={() => setShowAiModal(false)}>×</button>
            </div>
            <div className="fund-details-content">
              <div style={{ marginBottom: 16 }}>
                <button
                  disabled={aiLoading}
                  onClick={async () => {
                    if (!userInput) return;
                    setAiLoading(true);
                    setAiResult(null);
                    try {
                      const percentages = allocationData.reduce((acc, item) => {
                        const key = item.name.split(" ")[0].toUpperCase();
                        acc[key] = Math.round(item.value);
                        return acc;
                      }, {});

                      const payload = {
                        holdings: funds.map((fund) => ({
                          scheme_name: fund.scheme_name,
                          amfi_code: fund.amfi_code,
                          category: fund.category,
                          current_value: fund.current_value,
                          units: fund.units,
                          risk_level: fund.risk_level,
                          risk_source_type: fund.risk_source_type,
                          risk_source_url: fund.risk_source_url,
                        })),
                        categoryPercentages: percentages,
                        durationMonths: userInput.duration_months,
                        investmentAmount: userInput.investable_amount,
                        expectedRoi: userInput.expected_roi,
                      };
                      const res = await evaluateChoice(payload);
                      setAiResult(res);
                    } catch (e) {
                      console.error("AI evaluation failed", e);
                      const isRateLimit = e?.response?.status === 429 || String(e?.message).includes("429");
                      const message = isRateLimit
                        ? "Gemini API limit reached. Please wait a moment and try again, or continue with the rule-based analysis below."
                        : (e?.response?.data?.error || e?.message || "Failed to fetch recommendation");
                      setAiResult({ error: message });
                    } finally {
                      setAiLoading(false);
                    }
                  }}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    background: "#f3f4f6",
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  Generate Recommendation
                </button>
              </div>

              {/* Result */}
              {aiLoading && <div className="loading">Fetching AI recommendation...</div>}
              {aiResult && !aiLoading && (
                <div className="ai-result">
                  {aiResult?.error && (
                    <div className="ai-alert ai-alert--error">
                      {aiResult.error}
                    </div>
                  )}

                  {!!aiResult?.aiEvaluation && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div className="ai-badges" style={{ margin: 0 }}>
                          <span className="ai-badge ai-badge--neutral">
                            Recommended: {formatEnum(aiResult.aiEvaluation.recommendedDirection) || "—"}
                          </span>
                        </div>
                        {aiResult.aiEvaluation.llm?.status === "SUCCESS" ? (
                          <div style={{ fontSize: "11px", color: "#6b7280", fontStyle: "italic", display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ width: 8, height: 8, background: "#8b5cf6", borderRadius: "50%" }}></span>
                            Powered by Gemini AI
                          </div>
                        ) : (
                          <div style={{ fontSize: "11px", color: "#9ca3af", fontStyle: "italic" }}>
                            Rule-based Fallback (Gemini unavailable)
                          </div>
                        )}
                      </div>

                      {!!aiResult.aiEvaluation.diversificationStatus && (
                        <div style={{ marginBottom: 12 }}>
                          <span
                            className="ai-badge"
                            style={getDiversificationStyle(aiResult.aiEvaluation.diversificationStatus)}
                          >
                            {formatEnum(aiResult.aiEvaluation.diversificationStatus)}
                          </span>
                        </div>
                      )}

                      <div className="ai-card">
                        <div className="ai-card-title">Summary</div>
                        <div className="ai-card-text" style={{ fontSize: "1.1rem", lineHeight: "1.5" }}>
                          {aiResult.aiEvaluation.summary || "—"}
                        </div>
                      </div>

                      {!!aiResult.aiEvaluation.detailedExplanation?.newInvestmentReasoning && (
                        <div className="ai-card">
                          <div className="ai-card-title">AI Analysis</div>
                          <div className="ai-card-text">
                            {aiResult.aiEvaluation.detailedExplanation.newInvestmentReasoning}
                          </div>
                        </div>
                      )}

                      {aiResult.aiEvaluation.adviceForNewInvestment?.length > 0 && (
                        <div className="ai-card">
                          <div className="ai-card-title">Investment Strategy</div>
                          <ol className="ai-steps">
                            {aiResult.aiEvaluation.adviceForNewInvestment.map((item, index) => (
                              <li key={index} className="ai-step">
                                {item}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {aiResult.aiEvaluation.improvementSteps?.length > 0 && (
                        <div className="ai-card">
                          <div className="ai-card-title">Next Steps</div>
                          <ol className="ai-steps">
                            {aiResult.aiEvaluation.improvementSteps.map((item, index) => (
                              <li key={index} className="ai-step">
                                {item}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {aiResult.aiEvaluation.concentrationFlags?.length > 0 && (
                        <div className="ai-card" style={{ borderLeft: "4px solid #f59e0b", background: "#fffbeb" }}>
                          <div className="ai-card-title" style={{ color: "#92400e" }}>Concentration Alerts</div>
                          <ul className="ai-steps" style={{ listStyleType: "disc", paddingLeft: "20px" }}>
                            {aiResult.aiEvaluation.concentrationFlags.map((item, index) => (
                              <li key={index} className="ai-step" style={{ marginBottom: "8px" }}>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="ai-card" style={{ display: "flex", gap: 10, flexWrap: "wrap", background: "transparent", boxShadow: "none", padding: 0 }}>
                        <button
                          onClick={openAiChatbot}
                          style={{
                            padding: "12px 24px",
                            borderRadius: 8,
                            border: "none",
                            background: "#2563eb",
                            color: "white",
                            fontWeight: "600",
                            cursor: "pointer",
                            flex: 1
                          }}
                        >
                          Deep Dive with AI Chatbot
                        </button>
                        <button
                          onClick={() => setShowAiModal(false)}
                          style={{
                            padding: "12px 24px",
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                            background: "white",
                            color: "#374151",
                            fontWeight: "600",
                            cursor: "pointer",
                            flex: 1
                          }}
                        >
                          Close
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Helper functions for styling and formatting
const getDiversificationStyle = (status) => {
  const baseStyle = {
    padding: "4px 12px",
    borderRadius: "9999px",
    fontWeight: 600,
    fontSize: "12px",
    textTransform: "uppercase",
  };

  switch (status) {
    case "WELL_DIVERSIFIED":
      return { ...baseStyle, background: "#dcfce7", color: "#166534" };
    case "OVERCONCENTRATED":
      return { ...baseStyle, background: "#fee2e2", color: "#991b1b" };
    case "UNDEREXPOSED":
      return { ...baseStyle, background: "#fef9c3", color: "#854d0e" };
    default:
      return baseStyle;
  }
};

function formatEnum(value) {
  if (!value) return "";
  return String(value).replace(/_/g, " ");
}

function formatPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n)}%`;
}

export default PortfolioPage;
