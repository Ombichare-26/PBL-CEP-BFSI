import "./Investmentform.Inputpage.css";

export default function InvestmentForm({ investmentData, setInvestmentData }) {
  return (
    <div className="investment-form">
      <div className="investment-form__header">
        <span className="investment-form__tag">Step 2</span>
        <h3>Investment Details</h3>
      </div>

      <div className="form-group">
        <label htmlFor="investable-amount">Investable Amount</label>
        <input
          id="investable-amount"
          type="number"
          placeholder="e.g. 100000"
          value={investmentData.amount}
          onChange={(e) =>
            setInvestmentData(prev => ({ ...prev, amount: e.target.value }))
          }
        />
      </div>

      <div className="form-group">
        <label htmlFor="expected-roi">Expected ROI (%)</label>
        <input
          id="expected-roi"
          type="number"
          placeholder="e.g. 12"
          value={investmentData.roi}
          onChange={(e) =>
            setInvestmentData(prev => ({ ...prev, roi: e.target.value }))
          }
        />
      </div>

      <div className="form-group">
        <label htmlFor="duration-months">Duration (months)</label>
        <input
          id="duration-months"
          type="number"
          placeholder="e.g. 36"
          value={investmentData.duration}
          onChange={(e) =>
            setInvestmentData(prev => ({ ...prev, duration: e.target.value }))
          }
        />
      </div>
    </div>
  );
}
