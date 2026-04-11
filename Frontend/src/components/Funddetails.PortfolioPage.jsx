import { useState, useEffect } from "react";
import FundGraph from "./Fundgraph.PortfolioPage";
import { getFundHistoricalNav } from "../services/fundService.PortfolioPage";

function formatRiskometer(value) {
  if (!value) return "Not verified";
  return String(value).replace(/_/g, " ");
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN");
}

function formatRiskScore(value) {
  const score = Number(value);
  return Number.isFinite(score) && score > 0 ? `${score} / 6` : "—";
}

function formatRiskSource(value) {
  if (!value) return "Unverified";

  return String(value)
    .replace(/^MASTER_CACHE$/, "MASTER CACHE")
    .replace(/^GEMINI_THIRD_PARTY_/, "")
    .replace(/^GEMINI_/, "")
    .replace(/_/g, " ");
}

function FundDetails({ fund, onClose }) {
  const [selectedPeriod, setSelectedPeriod] = useState("1m");
  const [historicalData, setHistoricalData] = useState([]);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [riskMetrics, setRiskMetrics] = useState(null);

  const [liveData, setLiveData] = useState({
    currentNav: fund?.nav || 0,
    dayChange: 0
  });

  useEffect(() => {
    if (!fund?.amfi_code || fund.amfi_code === "NOT_FOUND") return;

    const fetchHistoricalData = async () => {
      try {
        setLoadingHistorical(true);

        const response = await getFundHistoricalNav(
          fund.amfi_code,
          selectedPeriod
        );

        // Graph data
        setHistoricalData(response.data || []);

        // Live NAV + day change (FIXED STRUCTURE)
        setLiveData({
          currentNav: response.currentNav ?? 0,
          dayChange: response.dayChange ?? 0
        });
        setRiskMetrics(response.riskMetrics || null);

      } catch (err) {
        console.error("Error fetching historical data:", err);
        setHistoricalData([]);
        setRiskMetrics(null);
      } finally {
        setLoadingHistorical(false);
      }
    };

    fetchHistoricalData();
  }, [fund?.amfi_code, selectedPeriod]);

  if (!fund) return null;

  const periods = [
    { code: "1d", label: "1 Day" },
    { code: "1m", label: "1 Month" },
    { code: "3m", label: "3 Months" },
    { code: "1y", label: "1 Year" },
    { code: "5y", label: "5 Years" }
  ];

  const dayChange = liveData.dayChange;
  const currentNav = liveData.currentNav;
  const isPositive = dayChange > 0;
  const displayedRiskLevel = fund.risk_level || "";
  const displayedRiskSource = fund.risk_source_type || "";
  const displayedRiskDate = fund.risk_as_of_date || fund.risk_last_verified_at || null;

  return (
    <div className="fund-details-overlay" onClick={onClose}>
      <div className="fund-details-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="fund-details-header">
          <h2>{fund.scheme_name}</h2>
          {onClose && (
            <button className="close-btn" onClick={onClose}>×</button>
          )}
        </div>

        <div className="fund-details-content">

          {/* Live NAV Section */}
          <div className="fund-price-section">
            <div className="price-info">
              <div className="price-label">Current NAV</div>
              <div className="price-value">
                ₹{currentNav.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 4
                })}
              </div>
            </div>

            <div className={`day-change ${isPositive ? "positive" : "negative"}`}>
              <span className="change-label">Day Change</span>
              <span className="change-value">
                {isPositive ? "+" : ""}
                {dayChange.toFixed(2)}%
              </span>
            </div>

            {fund.amfi_code && fund.amfi_code !== "NOT_FOUND" && (
              <div className="amfi-code">
                AMFI Code: {fund.amfi_code}
              </div>
            )}
            <div className="riskometer-inline">
              <span className="riskometer-inline__label">Risk-o-meter</span>
              <span className={`riskometer-chip ${displayedRiskLevel ? "riskometer-chip--verified" : "riskometer-chip--unverified"}`}>
                {formatRiskometer(displayedRiskLevel)}
              </span>
              <span className="riskometer-inline__source">
                Source: {formatRiskSource(displayedRiskSource)}
              </span>
            </div>
          </div>

          {/* Period Buttons */}
          <div className="period-selector">
            {periods.map((period) => (
              <button
                key={period.code}
                className={`period-btn ${
                  selectedPeriod === period.code ? "active" : ""
                }`}
                onClick={() => setSelectedPeriod(period.code)}
              >
                {period.label}
              </button>
            ))}
          </div>

          {/* Graph Section */}
          <div className="graph-section">
            {loadingHistorical ? (
              <div className="loading">Loading historical data...</div>
            ) : historicalData.length > 0 ? (
              <FundGraph data={historicalData} period={selectedPeriod} />
            ) : (
              <div className="no-data">No historical data available</div>
            )}
          </div>

          {/* Fund Info */}
          <div className="fund-info">
            <div className="info-row">
              <span className="info-label">Units:</span>
              <span className="info-value">
                {fund.units?.toLocaleString("en-IN", {
                  maximumFractionDigits: 4
                }) || "—"}
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">Current Value:</span>
              <span className="info-value">
                ₹{(currentNav * (fund.units || 0)).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">Category:</span>
              <span className="info-value">
                {fund.category || "—"}
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">Risk-o-meter:</span>
              <span className="info-value">
                {formatRiskometer(displayedRiskLevel)}
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">Risk Verified On:</span>
              <span className="info-value">
                {formatDate(displayedRiskDate)}
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">Risk Source:</span>
              <span className="info-value">
                {formatRiskSource(displayedRiskSource)}
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">Derived Risk Score:</span>
              <span className="info-value">
                {formatRiskScore(fund.derived_risk_score || riskMetrics?.derivedRiskScore)}
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">Volatility:</span>
              <span className="info-value">
                {fund.volatility_pct ?? riskMetrics?.volatilityPct ?? "—"}
                {fund.volatility_pct != null || riskMetrics?.volatilityPct != null ? "%" : ""}
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">Max Drawdown:</span>
              <span className="info-value">
                {fund.max_drawdown_pct ?? riskMetrics?.maxDrawdownPct ?? "—"}
                {fund.max_drawdown_pct != null || riskMetrics?.maxDrawdownPct != null ? "%" : ""}
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">Lookup Status:</span>
              <span className="info-value">
                {fund.risk_lookup_status || "—"}
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">Lookup Query:</span>
              <span className="info-value">
                {fund.risk_lookup_query || "—"}
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">Risk Source URL:</span>
              <span className="info-value" style={{ wordBreak: "break-word" }}>
                {fund.risk_source_url || riskMetrics?.sourceUrl || "—"}
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default FundDetails;
