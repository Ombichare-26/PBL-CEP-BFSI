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
  const sessionIdFromStorage =
    typeof window !== "undefined" ? localStorage.getItem(SESSION_KEY) : null;
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
  const [animatedTotal, setAnimatedTotal] = useState(0);

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
          else totals.OTHER += value;
        }

        setAllocationData([
          { name: "Small Cap", value: grandTotal > 0 ? (totals.SMALL / grandTotal) * 100 : 0 },
          { name: "Flexi Cap", value: grandTotal > 0 ? (totals.FLEXI / grandTotal) * 100 : 0 },
          { name: "ETF", value: grandTotal > 0 ? (totals.ETF / grandTotal) * 100 : 0 },
          { name: "Other", value: grandTotal > 0 ? (totals.OTHER / grandTotal) * 100 : 0 },
        ]);
      } catch (error) {
        if (!cancelled) console.error("Error fetching data:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const filteredFunds =
    selectedCategory === "ALL"
      ? funds
      : funds.filter((fund) => fund.category === selectedCategory);

  const totalPortfolioValue = funds.reduce((sum, fund) => {
    return sum + (Number(fund.current_value) || 0);
  }, 0);

  const categoryTotals = funds.reduce(
    (acc, fund) => {
      const key = fund.category || "OTHER";
      const value = Number(fund.current_value) || 0;
      acc[key] = (acc[key] || 0) + value;
      return acc;
    },
    { ETF: 0, FLEXI: 0, SMALL: 0, OTHER: 0 }
  );

  const topCategoryEntry = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  const topCategory = topCategoryEntry?.[1] > 0 ? topCategoryEntry[0] : "";

  useEffect(() => {
    const duration = 1400;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setAnimatedTotal(progress * totalPortfolioValue);
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    if (totalPortfolioValue > 0) {
      requestAnimationFrame(animate);
    } else {
      setAnimatedTotal(0);
    }
  }, [totalPortfolioValue]);

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

  const openAiChatbot = () => {
    if (!aiResult?.aiEvaluation) return;
    const planningContext = {
      durationMonths:
        aiResult?.inputs?.durationMonths ?? Number(userInput?.duration_months) ?? 0,
      expectedRoi: aiResult?.inputs?.expectedRoi ?? Number(userInput?.expected_roi) ?? 0,
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

  if (!sessionId) {
    return (
      <div className="portfolio-state">
        <div className="portfolio-state__card">
          <span className="section-heading__eyebrow">Portfolio</span>
          <h2>No session found</h2>
          <p>Please upload your CAS PDF and complete the input flow to unlock your dashboard.</p>
          <a className="portfolio-primary-btn" href="/input">
            Go to Input page
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="portfolio-state">
        <div className="portfolio-state__card">
          <span className="section-heading__eyebrow">Portfolio</span>
          <h2>Loading portfolio...</h2>
          <p>We’re preparing your holdings, category mix, and recommendation context.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="portfolio-page">
      <section className="portfolio-hero">
        <div className="portfolio-hero__copy">
          <span className="portfolio-hero__eyebrow">Portfolio dashboard</span>
          <h1>Your investments, organized at a glance.</h1>
          <p>
            Review your holdings, understand category concentration, and open AI guidance
            from one streamlined dashboard.
          </p>

          <div className="portfolio-hero__actions">
            <button
              type="button"
              className="portfolio-primary-btn"
              onClick={() => setShowAiModal(true)}
            >
              Show AI Recommendation
            </button>
            <button
              type="button"
              className="portfolio-secondary-btn"
              onClick={() => navigate("/news")}
            >
              Explore Market News
            </button>
          </div>
        </div>

        <div className="portfolio-hero__value-card">
          <span>Total portfolio value</span>
          <strong>
            ₹{" "}
            {animatedTotal.toLocaleString("en-IN", {
              maximumFractionDigits: 0,
            })}
          </strong>
          <p>Animated overview based on the portfolio data loaded for this session.</p>
        </div>
      </section>

      <section className="portfolio-metrics">
        <article className="portfolio-metric-card">
          <span>Funds tracked</span>
          <strong>{funds.length}</strong>
          <p>Total holdings currently available in your portfolio view.</p>
        </article>
        <article className="portfolio-metric-card">
          <span>Active filter</span>
          <strong>
            {selectedCategory === "ALL" ? "All categories" : formatCategory(selectedCategory)}
          </strong>
          <p>Use category filters to inspect one segment of the portfolio at a time.</p>
        </article>
        <article className="portfolio-metric-card">
          <span>Largest category</span>
          <strong>{formatCategory(topCategory)}</strong>
          <p>Quick snapshot of the category currently carrying the highest portfolio weight.</p>
        </article>
      </section>

      {userInput && <UserInputSummary data={userInput} />}

      <section className="chart-section">
        <div className="chart-panel">
          <div className="section-heading">
            <span className="section-heading__eyebrow">Allocation</span>
            <h3>Category distribution</h3>
            <p>See how your holdings are spread across ETF, Flexi Cap, Small Cap, and Other.</p>
          </div>
          <AllocationPieChart data={allocationData} />
        </div>

        <aside className="filter-panel">
          <div className="section-heading">
            <span className="section-heading__eyebrow">Filters</span>
            <h3>Focus the fund table</h3>
            <p>Switch the table instantly to compare holdings inside a specific category.</p>
          </div>
          <CategoryButtons selected={selectedCategory} onSelect={setSelectedCategory} />
        </aside>
      </section>

      <FundTable funds={filteredFunds} onFundClick={handleFundClick} />

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

      {showAiModal && (
        <div className="fund-details-overlay">
          <div className="fund-details-modal fund-details-modal--ai">
            <div className="fund-details-header">
              <h2>AI Recommendation (Based on Your Inputs)</h2>
              <button className="close-btn" type="button" onClick={() => setShowAiModal(false)}>
                ×
              </button>
            </div>
            <div className="fund-details-content">
              <div className="ai-modal__intro">
                <p>
                  Generate an AI-backed review of your current allocation versus your stated
                  investment goal, duration, and expected return.
                </p>
                <button
                  type="button"
                  className="portfolio-secondary-btn portfolio-secondary-btn--wide"
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
                      const isRateLimit =
                        e?.response?.status === 429 || String(e?.message).includes("429");
                      const message = isRateLimit
                        ? "Gemini API limit reached. Please wait a moment and try again, or continue with the rule-based analysis below."
                        : e?.response?.data?.error || e?.message || "Failed to fetch recommendation";
                      setAiResult({ error: message });
                    } finally {
                      setAiLoading(false);
                    }
                  }}
                >
                  Generate Recommendation
                </button>
              </div>

              {aiLoading && <div className="loading">Fetching AI recommendation...</div>}
              {aiResult && !aiLoading && (
                <div className="ai-result">
                  {aiResult?.error && <div className="ai-alert ai-alert--error">{aiResult.error}</div>}

                  {!!aiResult?.aiEvaluation && (
                    <>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 12,
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div className="ai-badges" style={{ margin: 0 }}>
                          <span className="ai-badge ai-badge--neutral">
                            Recommended:{" "}
                            {formatEnum(aiResult.aiEvaluation.recommendedDirection) || "—"}
                          </span>
                        </div>
                        {aiResult.aiEvaluation.llm?.status === "SUCCESS" ? (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#6b7280",
                              fontStyle: "italic",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                background: "#8b5cf6",
                                borderRadius: "50%",
                              }}
                            />
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
                            style={getDiversificationStyle(
                              aiResult.aiEvaluation.diversificationStatus
                            )}
                          >
                            {formatEnum(aiResult.aiEvaluation.diversificationStatus)}
                          </span>
                        </div>
                      )}

                      <div className="ai-card">
                        <div className="ai-card-title">Summary</div>
                        <div className="ai-card-text">
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
                        <div
                          className="ai-card"
                          style={{ borderLeft: "4px solid #f59e0b", background: "#fffbeb" }}
                        >
                          <div className="ai-card-title" style={{ color: "#92400e" }}>
                            Concentration Alerts
                          </div>
                          <ul className="ai-steps" style={{ listStyleType: "disc", paddingLeft: "20px" }}>
                            {aiResult.aiEvaluation.concentrationFlags.map((item, index) => (
                              <li key={index} className="ai-step" style={{ marginBottom: "8px" }}>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div
                        className="ai-card"
                        style={{
                          display: "flex",
                          gap: 10,
                          flexWrap: "wrap",
                          background: "transparent",
                          boxShadow: "none",
                          padding: 0,
                        }}
                      >
                        <button
                          type="button"
                          onClick={openAiChatbot}
                          className="portfolio-primary-btn"
                          style={{ flex: 1 }}
                        >
                          Deep Dive with AI Chatbot
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAiModal(false)}
                          className="portfolio-secondary-btn"
                          style={{ flex: 1 }}
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
    </div>
  );
}

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

const CATEGORY_MAP = {
  ALL: "All",
  SMALL: "Small Cap",
  FLEXI: "Flexi Cap",
  ETF: "ETF",
  OTHER: "Other"
};

function formatCategory(value) {
  if (!value) return "—";
  return CATEGORY_MAP[value] || formatEnum(value);
}

export default PortfolioPage;
