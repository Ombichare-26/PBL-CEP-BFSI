export default function InvestmentForm({ investmentData, setInvestmentData }) {
  return (
    <div>
      <h3>Investment Details</h3>

      <input
        type="number"
        placeholder="Investable Amount"
        value={investmentData.amount}
        onChange={(e) =>
          setInvestmentData(prev => ({ ...prev, amount: e.target.value }))
        }
      />

      <br /><br />

      <input
        type="number"
        placeholder="Expected ROI (%)"
        value={investmentData.roi}
        onChange={(e) =>
          setInvestmentData(prev => ({ ...prev, roi: e.target.value }))
        }
      />

      <br /><br />

      <input
        type="number"
        placeholder="Duration (months)"
        value={investmentData.duration}
        onChange={(e) =>
          setInvestmentData(prev => ({ ...prev, duration: e.target.value }))
        }
      />
    </div>
  );
}
