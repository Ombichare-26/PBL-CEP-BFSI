function FundTable({ funds, onFundClick }) {
    if (!funds.length) return <p>No funds available</p>;
  
    return (
      <table className="fund-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>NAV</th>
            <th>Units</th>
            <th>Current Value</th>
          </tr>
        </thead>
        <tbody>
          {funds.map((fund) => (
            <tr key={fund._id} onClick={() => onFundClick(fund)}>
              <td>{fund.scheme_name}</td>
              <td>{fund.nav}</td>
              <td>{fund.units}</td>
              <td>₹{fund.current_value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  
  export default FundTable;
  