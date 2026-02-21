import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import UserInputSummary from "../components/UserInputSummary.PortfolioPage";
import AllocationPieChart from "../components/AllocationPieChart.PortfolioPage";
import CategoryButtons from "../components/Categorybuttons.PortfolioPage";
import FundTable from "../components/Fundtable.PortfolioPage";
import FundDetails from "../components/Funddetails.PortfolioPage";
import { getUserInput, getPortfolio } from "../services/PortfolioService.PortfolioPage";
import { getFundDetails } from "../services/fundService.PortfolioPage";
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

        const total = fundsData.length || 1;
        const small = fundsData.filter(f => f.category === "SMALL").length;
        const flexi = fundsData.filter(f => f.category === "FLEXI").length;
        const etf = fundsData.filter(f => f.category === "ETF").length;
        const other = fundsData.filter(f => f.category === "OTHER").length;

        setAllocationData([
          { name: "Small Cap", value: (small / total) * 100 },
          { name: "Flexi Cap", value: (flexi / total) * 100 },
          { name: "ETF", value: (etf / total) * 100 },
          { name: "Other", value: (other / total) * 100 }
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
    </>
  );
}

export default PortfolioPage;

