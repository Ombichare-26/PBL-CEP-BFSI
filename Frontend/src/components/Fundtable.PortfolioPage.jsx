function formatCurrency(num) {
  if (num == null || Number.isNaN(num)) return "—";
  return (
    "₹" +
    Number(num).toLocaleString("en-IN", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })
  );
}

const CATEGORY_MAP = {
  ALL: "All",
  SMALL: "Small Cap",
  FLEXI: "Flexi Cap",
  ETF: "ETF",
  OTHER: "Other"
};

function formatCategory(value) {
  if (!value) return "—";
  return CATEGORY_MAP[value] || value;
}

function formatRiskometer(value) {
  if (!value) return "Unverified";
  return String(value).replace(/_/g, " ");
}

function FundTable({ funds, onFundClick }) {
  if (!funds.length) {
    return (
      <div className="fund-table-empty">
        <h3>No funds in this category</h3>
        <p>Switch the category filter to explore more holdings in your portfolio.</p>
      </div>
    );
  }

  return (
    <div className="fund-table-shell">
      <div className="fund-table-shell__header">
        <div>
          <span className="section-heading__eyebrow">Holdings</span>
          <h3>Fund Breakdown</h3>
        </div>
        <p>Open any row to inspect scheme-level details, live NAV data, and recent performance.</p>
      </div>

      <div className="fund-table-wrap">
        <table className="fund-table">
          <thead>
            <tr>
              <th>AMFI Code</th>
              <th>Name</th>
              <th>Category</th>
              <th>Risk</th>
              <th>NAV</th>
              <th>Units</th>
              <th>Current Value</th>
            </tr>
          </thead>
          <tbody>
            {funds.map((fund) => {
              const nav = fund.nav != null ? Number(fund.nav) : null;
              const units = fund.units != null ? Number(fund.units) : 0;
              const currentValue =
                fund.current_value != null && !Number.isNaN(Number(fund.current_value))
                  ? Number(fund.current_value)
                  : (nav != null && !Number.isNaN(nav) ? nav : 0) * units;

              return (
                <tr key={fund._id} onClick={() => onFundClick(fund)}>
                  <td className="fund-table__code">
                    {fund.amfi_code && fund.amfi_code !== "NOT_FOUND" ? fund.amfi_code : "—"}
                  </td>
                  <td className="fund-table__name">
                    <span>{fund.scheme_name}</span>
                  </td>
                  <td>{formatCategory(fund.category)}</td>
                  <td>
                    <span className={`riskometer-chip ${fund.risk_level ? "riskometer-chip--verified" : "riskometer-chip--unverified"}`}>
                      {formatRiskometer(fund.risk_level)}
                    </span>
                  </td>
                  <td>{nav != null && !Number.isNaN(nav) ? formatCurrency(nav) : "—"}</td>
                  <td>{units.toLocaleString("en-IN", { maximumFractionDigits: 4 })}</td>
                  <td className="fund-table__value">{formatCurrency(currentValue)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default FundTable;
