import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import UserInputSummary from "../components/UserInputSummary.PortfolioPage";
import AllocationPieChart from "../components/AllocationPieChart.PortfolioPage";
import CategoryButtons from "../components/Categorybuttons.PortfolioPage";
import FundTable from "../components/Fundtable.PortfolioPage";
import FundDetails from "../components/Funddetails.PortfolioPage";
import { getUserInput, getPortfolio } from "../services/PortfolioService.PortfolioPage";
import { getFundDetails } from "../services/yahooService.PortfolioPage";

function PortfolioPage() {
  const sessionId = "698e17f924b1fd63d1a5807d"; // later make dynamic

  const [userInput, setUserInput] = useState(null);
  const [allocationData, setAllocationData] = useState([]);
  const [funds, setFunds] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("FLEXI");
  const [selectedFund, setSelectedFund] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const inputRes = await getUserInput(sessionId);
        const portfolioRes = await getPortfolio(sessionId);

        const fundsData = portfolioRes.data.data;

        setUserInput(inputRes.data.data);
        setFunds(fundsData);

        // ---- Calculate Allocation ----
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

        setLoading(false);

      } catch (error) {
        console.error("Error fetching data:", error);
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // ---- Filter Funds By Category ----
  const filteredFunds = funds.filter(
    (fund) => fund.category === selectedCategory
  );

  // ---- Handle Fund Click ----
  const handleFundClick = async (fund) => {
    try {
      setSelectedFund(fund);

      if (!fund.ticker) return; // safety check

      const response = await getFundDetails(fund.ticker);
      setLiveData(response.data);

    } catch (error) {
      console.error("Error fetching fund details:", error);
    }
  };

  if (loading) {
    return <h2 style={{ textAlign: "center" }}>Loading Portfolio...</h2>;
  }

  return (
    <>
      

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

      {/* Fund Details */}
      {selectedFund && (
        <FundDetails
          fund={selectedFund}
          liveData={liveData}
        />
      )}
    </>
  );
}

export default PortfolioPage;

