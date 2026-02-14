import FundGraph from "./Fundgraph.PortfolioPage";

function FundDetails({ fund, liveData }) {
  if (!fund) return null;

  return (
    <div className="fund-details">
      <h3>{fund.scheme_name}</h3>
      <p>Live Price: ₹{liveData?.livePrice}</p>
      <p>Day Change: {liveData?.dayChange}%</p>
      <FundGraph data={liveData?.historicalPrices || []} />
    </div>
  );
}

export default FundDetails;
