import { useState, useEffect } from "react";
import FundGraph from "./Fundgraph.PortfolioPage";
import { getFundHistoricalNav } from "../services/fundService.PortfolioPage";

function FundDetails({ fund, liveData, onClose }) {
  const [selectedPeriod, setSelectedPeriod] = useState("1m");
  const [historicalData, setHistoricalData] = useState(null);
  const [loadingHistorical, setLoadingHistorical] = useState(false);

  useEffect(() => {
    if (!fund?.amfi_code || fund.amfi_code === "NOT_FOUND") return;
    
    const fetchHistorical = async () => {
      setLoadingHistorical(true);
      try {
        const response = await getFundHistoricalNav(fund.amfi_code, selectedPeriod);
        setHistoricalData(response.data?.data || []);
      } catch (error) {
        console.error("Error fetching historical NAV:", error);
        setHistoricalData([]);
      } finally {
        setLoadingHistorical(false);
      }
    };

    fetchHistorical();
  }, [fund?.amfi_code, selectedPeriod]);

  if (!fund) return null;

  const periods = [
    { code: "1d", label: "1 Day" },
    { code: "1m", label: "1 Month" },
    { code: "3m", label: "3 Months" },
    { code: "1y", label: "1 Year" },
    { code: "5y", label: "5 Years" }
  ];

  const dayChange = liveData?.data?.dayChange;
  const currentNav = liveData?.data?.currentNav || fund.nav || 0;
  const isPositive = dayChange && dayChange > 0;

  return (
    <div className="fund-details-overlay" onClick={onClose}>
      <div className="fund-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fund-details-header">
          <h2>{fund.scheme_name}</h2>
          {onClose && (
            <button className="close-btn" onClick={onClose}>×</button>
          )}
        </div>

        <div className="fund-details-content">
          {/* Live Price & Day Change */}
          <div className="fund-price-section">
            <div className="price-info">
              <div className="price-label">Current NAV</div>
              <div className="price-value">₹{currentNav.toLocaleString("en-IN", { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 4 
              })}</div>
            </div>
            {dayChange !== null && dayChange !== undefined && (
              <div className={`day-change ${isPositive ? "positive" : "negative"}`}>
                <span className="change-label">Day Change</span>
                <span className="change-value">
                  {isPositive ? "+" : ""}{dayChange.toFixed(2)}%
                </span>
              </div>
            )}
            {fund.amfi_code && fund.amfi_code !== "NOT_FOUND" && (
              <div className="amfi-code">AMFI Code: {fund.amfi_code}</div>
            )}
          </div>

          {/* Period Selector */}
          <div className="period-selector">
            {periods.map((period) => (
              <button
                key={period.code}
                className={`period-btn ${selectedPeriod === period.code ? "active" : ""}`}
                onClick={() => setSelectedPeriod(period.code)}
              >
                {period.label}
              </button>
            ))}
          </div>

          {/* Historical Graph */}
          <div className="graph-section">
            {loadingHistorical ? (
              <div className="loading">Loading historical data...</div>
            ) : historicalData && historicalData.length > 0 ? (
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
                {fund.units?.toLocaleString("en-IN", { maximumFractionDigits: 4 }) || "—"}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Current Value:</span>
              <span className="info-value">
                ₹{((currentNav || 0) * (fund.units || 0)).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Category:</span>
              <span className="info-value">{fund.category || "—"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FundDetails;
