import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#1d4ed8", "#0f766e", "#d97706", "#7c3aed"];

function AllocationPieChart({ data }) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="allocation-chart">
      <div className="allocation-chart__canvas">
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={74}
              outerRadius={110}
              paddingAngle={4}
              stroke="rgba(255,255,255,0.9)"
              strokeWidth={3}
            >
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]} />
          </PieChart>
        </ResponsiveContainer>

        <div className="allocation-chart__center">
          <span>Allocation mix</span>
          <strong>{total.toFixed(0)}%</strong>
        </div>
      </div>

      <div className="allocation-chart__legend">
        {data.map((entry, index) => (
          <div key={entry.name} className="allocation-chart__legend-item">
            <span
              className="allocation-chart__legend-dot"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <div>
              <strong>{entry.name}</strong>
              <span>{entry.value.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AllocationPieChart;
