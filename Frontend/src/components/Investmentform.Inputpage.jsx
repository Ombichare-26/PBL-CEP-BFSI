import "./InvestmentForm.css";

export default function InvestmentForm({
  amount,
  duration,
  expectedRoi,
  onAmountChange,
  onDurationChange,
  onRoiChange
}) {
  return (
    <div className="investment-form">
      <h3>Investment Details</h3>

      <div className="form-group">
        <label>Investment Amount (₹)</label>
        
        <input
          type="number"
          placeholder="e.g. 500000"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>Duration (Years)</label>
        <input
          type="number"
          placeholder="e.g. 10"
          value={duration}
          onChange={(e) => onDurationChange(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>Expected ROI (%)</label>
        <input
          type="number"
          placeholder="e.g. 12"
          value={expectedRoi}
          onChange={(e) => onRoiChange(e.target.value)}
        />
      </div>
    </div>
  );
}
