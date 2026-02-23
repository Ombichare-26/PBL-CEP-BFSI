import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
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

function PortfolioPage() {
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
              <h2>Choose Recommendation Style</h2>
              <button className="close-btn" onClick={() => setShowAiModal(false)}>×</button>
            </div>
            <div className="fund-details-content">
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
                  {[
                    {
                      label: "Conservative",
                      description: "Focuses on capital preservation with lower risk and modest returns. Suitable for investors with a low risk tolerance."
                    },
                    {
                      label: "Balanced",
                      description: "Aims for a mix of safety and growth, with moderate risk and returns. Suitable for investors with a medium risk tolerance."
                    },
                    {
                      label: "Aggressive",
                      description: "Seeks high growth potential, accepting higher risk and market volatility. Suitable for investors with a high risk tolerance."
                    }
                  ].map(({ label, description }) => (
                    <div key={label} style={{ position: "relative" }}>
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
                              categoryPercentages: percentages,
                              durationMonths: userInput.duration_months,
                              investmentAmount: userInput.investable_amount,
                              expectedRoi: userInput.expected_roi,
                              userSelectedDirection: label
                            };
                            const res = await evaluateChoice(payload);
                            setAiResult(res);
                          } catch (e) {
                            console.error("AI evaluation failed", e);
                            const message =
                              e?.response?.data?.error ||
                              e?.message ||
                              "Failed to fetch recommendation";
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
                          width: "100%"
                        }}
                      >
                        {label}
                      </button>
                      <div className="info-icon" title={description}>
                        &#8505;
                      </div>
                    </div>
                  ))}
                </div>

              {/* Result */}
              {aiLoading && <div className="loading">Fetching AI recommendation...</div>}
              {aiResult && !aiLoading && (
                <div style={{ display: "grid", gap: 16, paddingTop: 16 }}>
                  {/* Verdict */}
                  <div className="info-row">
                    <span className="info-label">Verdict</span>
                    <span
                      className="info-value"
                      style={getVerdictStyle(aiResult?.aiEvaluation?.verdict)}
                    >
                      {formatVerdict(aiResult?.aiEvaluation?.verdict)}
                    </span>
                  </div>

                  {/* Summary */}
                  <div className="info-row">
                    <span className="info-label">Summary</span>
                    <span className="info-value" style={{ whiteSpace: "pre-wrap" }}>
                      {aiResult?.aiEvaluation?.summary || aiResult?.error || "—"}
                    </span>
                  </div>

                  {/* Suggested Direction */}
                  <div className="info-row">
                    <span className="info-label">Suggested Direction</span>
                    <span className="info-value">
                      {aiResult?.aiEvaluation?.suggestedDirection || "—"}
                    </span>
                  </div>

                  {/* Detailed Explanation */}
                  {aiResult?.aiEvaluation?.detailedExplanation && (
                    <div style={{ background: "#f9fafb", padding: 16, borderRadius: 8 }}>
                      <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 16 }}>Detailed Explanation</div>
                      <div style={{ fontSize: 14, color: "#374151", display: "grid", gap: 12 }}>
                        <div><strong>Allocation:</strong> {aiResult.aiEvaluation.detailedExplanation.allocationAnalysis}</div>
                        <div><strong>Risk vs Direction:</strong> {aiResult.aiEvaluation.detailedExplanation.riskVsDirection}</div>
                        <div><strong>Duration Impact:</strong> {formatDuration(aiResult.aiEvaluation.detailedExplanation.durationImpact)}</div>
                        <div><strong>ROI Expectation:</strong> {aiResult.aiEvaluation.detailedExplanation.roiExpectationCheck}</div>
                      </div>
                    </div>
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
const getVerdictStyle = (verdict) => {
  const baseStyle = {
    padding: "4px 12px",
    borderRadius: "9999px",
    fontWeight: 600,
    fontSize: "12px",
    textTransform: "uppercase",
  };
  switch (verdict) {
    case "RIGHT_CHOICE":
      return { ...baseStyle, background: "#dcfce7", color: "#166534" };
    case "WRONG_CHOICE":
      return { ...baseStyle, background: "#fee2e2", color: "#991b1b" };
    default:
      return {};
  }
};

const formatVerdict = (verdict) => {
  if (!verdict) return "—";
  return verdict.replace(/_/g, " ");
};

const formatDuration = (durationText) => {
  if (!durationText) return "";
  const match = durationText.match(/(\d+\.?\d*)/);
  if (match) {
    const years = parseFloat(match[0]);
    return durationText.replace(match[0], years.toFixed(1));
  }
  return durationText;
};

export default PortfolioPage;
