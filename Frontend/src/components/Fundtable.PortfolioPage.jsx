function formatCurrency(num) {
  if (num == null || Number.isNaN(num)) return "—";
  return "₹" + Number(num).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function FundTable({ funds, onFundClick }) {
  if (!funds.length) return <p>No funds in this category.</p>;

  return (
    <table className="fund-table">
      <thead>
        <tr>
          <th>AMFI Code</th>
          <th>Name</th>
          <th>NAV</th>
          <th>Units</th>
          <th>Current Value</th>
        </tr>
      </thead>
      <tbody>
        {funds.map((fund) => {
          const nav = fund.nav != null ? Number(fund.nav) : null;
          const units = fund.units != null ? Number(fund.units) : 0;
          const currentValue = (nav != null && !Number.isNaN(nav) ? nav : 0) * units;
          return (
            <tr key={fund._id} onClick={() => onFundClick(fund)}>
              <td style={{ fontFamily: "monospace", fontSize: "13px" }}>
                {fund.amfi_code && fund.amfi_code !== "NOT_FOUND" ? fund.amfi_code : "—"}
              </td>
              <td>{fund.scheme_name}</td>
              <td>{nav != null && !Number.isNaN(nav) ? formatCurrency(nav) : "—"}</td>
              <td>{units.toLocaleString("en-IN", { maximumFractionDigits: 4 })}</td>
              <td>{formatCurrency(currentValue)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
  
  export default FundTable;
  