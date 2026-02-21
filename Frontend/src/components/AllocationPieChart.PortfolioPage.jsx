import { PieChart, Pie, Cell, Tooltip } from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

function AllocationPieChart({ data }) {
  // Calculate total once
  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <PieChart width={600} height={300}>
      <Pie
        data={data}
        dataKey="value"
        nameKey="name"
        outerRadius={100}
        label={({ percent }) =>
          `${(percent * 100).toFixed(2)}%`
        }
      >
        {data.map((entry, index) => (
          <Cell key={index} fill={COLORS[index % COLORS.length]} />
        ))}
      </Pie>

      <Tooltip
        formatter={(value, name) => {
          const percentage = ((value / total) * 100).toFixed(2);

          return [
            `₹${Number(value).toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })} (${percentage}%)`,
            name
          ];
        }}
      />
    </PieChart>
  );
}

export default AllocationPieChart;