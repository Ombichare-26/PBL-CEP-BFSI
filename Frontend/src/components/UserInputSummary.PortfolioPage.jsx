function UserInputSummary({ data }) {
  if (!data) return null;

  const formatCurrency = (value) =>
    `₹${Number(value || 0).toLocaleString("en-IN", {
      maximumFractionDigits: 0,
    })}`;

  const items = [
    { label: "Investable amount", value: formatCurrency(data.investable_amount) },
    { label: "Expected ROI", value: `${data.expected_roi}%` },
    { label: "Time horizon", value: `${data.duration_months} months` },
  ];

  return (
    <section className="user-summary">
      <div className="section-heading">
        <span className="section-heading__eyebrow">Your profile</span>
        <h3>Investment Summary</h3>
        <p>The portfolio dashboard below is personalized using the goals you shared.</p>
      </div>

      <div className="user-summary__grid">
        {items.map((item) => (
          <article key={item.label} className="user-summary__card">
            <span className="user-summary__label">{item.label}</span>
            <strong className="user-summary__value">{item.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

export default UserInputSummary;
