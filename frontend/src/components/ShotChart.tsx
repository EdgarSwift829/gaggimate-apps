import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { TimeseriesPoint } from "../types";

interface Props {
  data: TimeseriesPoint[];
  height?: number;
}

export default function ShotChart({ data, height = 300 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis
          dataKey="t"
          label={{ value: "秒", position: "insideBottomRight", offset: -5 }}
          stroke="#888"
        />
        <YAxis yAxisId="pressure" stroke="#e94560" domain={[0, 12]} />
        <YAxis yAxisId="temp" orientation="right" stroke="#0ea5e9" domain={[80, 100]} />
        <Tooltip
          contentStyle={{ background: "#1a1a2e", border: "1px solid #333" }}
        />
        <Legend />
        <Line
          yAxisId="pressure"
          type="monotone"
          dataKey="pressure"
          stroke="#e94560"
          name="圧力 (bar)"
          dot={false}
          strokeWidth={2}
        />
        <Line
          yAxisId="temp"
          type="monotone"
          dataKey="temp"
          stroke="#0ea5e9"
          name="温度 (°C)"
          dot={false}
          strokeWidth={2}
        />
        <Line
          yAxisId="pressure"
          type="monotone"
          dataKey="weight"
          stroke="#22c55e"
          name="重量 (g)"
          dot={false}
          strokeWidth={2}
        />
        <Line
          yAxisId="pressure"
          type="monotone"
          dataKey="flow"
          stroke="#f59e0b"
          name="フロー (ml/s)"
          dot={false}
          strokeWidth={1}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
