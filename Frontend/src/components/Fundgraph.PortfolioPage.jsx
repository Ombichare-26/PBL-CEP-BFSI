import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

// Format date based on period
function formatDate(dateStr, period) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  
  switch (period) {
    case "1d":
      return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    case "1m":
    case "3m":
      return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    case "1y":
      return date.toLocaleDateString("en-IN", { month: "short" });
    case "5y":
      return date.toLocaleDateString("en-IN", { year: "2-digit", month: "short" });
    default:
      return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  }
}

// Custom tooltip component (defined outside to avoid recreation on each render)
function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="chart-tooltip">
        <p className="tooltip-date">{new Date(data.fullDate).toLocaleDateString("en-IN", {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric"
        })}</p>
        <p className="tooltip-value">NAV: ₹{data.nav.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4
        })}</p>
      </div>
    );
  }
  return null;
}

function FundGraph({ data, period = "1m" }) {
  if (!data || data.length === 0) {
    return <div className="no-graph-data">No data available for chart</div>;
  }

  // Format data for Recharts
  const chartData = data.map((item) => ({
    date: formatDate(item.date, period),
    nav: parseFloat(item.nav),
    fullDate: item.date
  }));

  // Calculate min/max for better Y-axis scaling
  const navValues = chartData.map(d => d.nav);
  const minNav = Math.min(...navValues);
  const maxNav = Math.max(...navValues);
  const padding = (maxNav - minNav) * 0.1;

  // Adjust x-axis interval based on period
  // For 1d, show more labels (every 2-3 hours); for others, preserve start/end
  const xAxisInterval = period === "1d" ? 2 : "preserveStartEnd";
  const xAxisAngle = period === "1d" ? -45 : 0; // Rotate labels for 1d to fit better

  return (
    <div className="fund-graph-container">
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: period === "1d" ? 40 : 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis 
            dataKey="date" 
            stroke="#666"
            style={{ fontSize: "12px" }}
            interval={xAxisInterval}
            angle={xAxisAngle}
            textAnchor={xAxisAngle !== 0 ? "end" : "middle"}
            height={xAxisAngle !== 0 ? 60 : undefined}
          />
          <YAxis 
            stroke="#666"
            style={{ fontSize: "12px" }}
            domain={[minNav - padding, maxNav + padding]}
            tickFormatter={(value) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          />
          <Tooltip content={CustomTooltip} />
          <Line 
            type="monotone" 
            dataKey="nav" 
            stroke="#2563eb" 
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: "#2563eb" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default FundGraph;
