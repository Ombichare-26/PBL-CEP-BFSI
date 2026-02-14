function UserInputSummary({ data }) {
    if (!data) return null;
  
    return (
      <div className="user-summary">
        <h3>Investment Summary</h3>
        <p>Amount: ₹{data.investable_amount}</p>
        <p>Expected ROI: {data.expected_roi}%</p>
        <p>Duration: {data.duration_months} months</p>
      </div>
    );
  }
  
  export default UserInputSummary;
  