import { useState, useEffect } from "react";
import ShotChart from "../components/ShotChart";
import type { TimeseriesPoint } from "../types";

// Generate mock realtime data
function generateMockPoint(t: number): TimeseriesPoint {
  const preinfusion = t < 5;
  return {
    t,
    pressure: preinfusion
      ? 2 + Math.random() * 1.5
      : 8.5 + Math.sin(t * 0.3) * 0.8 + Math.random() * 0.3,
    temp: 92.5 + Math.sin(t * 0.2) * 1.5 + Math.random() * 0.3,
    weight: Math.max(0, (t - 3) * 1.2 + Math.random() * 0.5),
    flow: preinfusion ? 0.5 + Math.random() * 0.3 : 1.8 + Math.sin(t * 0.5) * 0.4,
  };
}

export default function Brewing() {
  const [elapsed, setElapsed] = useState(0);
  const [data, setData] = useState<TimeseriesPoint[]>([]);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        setData((d) => [...d, generateMockPoint(next)]);
        if (next >= 30) {
          setRunning(false);
          clearInterval(interval);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  const latestPressure = data.length > 0 ? data[data.length - 1].pressure : null;
  const latestTemp = data.length > 0 ? data[data.length - 1].temp : null;
  const latestWeight = data.length > 0 ? data[data.length - 1].weight : null;

  return (
    <div style={{ color: "#fff" }}>
      <h1>抽出中</h1>

      {/* Live stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ background: "#1a1a2e", borderRadius: 8, padding: "1rem", textAlign: "center" }}>
          <div style={{ color: "#888", fontSize: "0.85rem" }}>経過時間</div>
          <div style={{ fontSize: "2rem", fontWeight: "bold" }}>{elapsed}s</div>
        </div>
        <div style={{ background: "#1a1a2e", borderRadius: 8, padding: "1rem", textAlign: "center" }}>
          <div style={{ color: "#888", fontSize: "0.85rem" }}>圧力</div>
          <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#e94560" }}>
            {latestPressure?.toFixed(1) ?? "--"} bar
          </div>
        </div>
        <div style={{ background: "#1a1a2e", borderRadius: 8, padding: "1rem", textAlign: "center" }}>
          <div style={{ color: "#888", fontSize: "0.85rem" }}>温度</div>
          <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#0ea5e9" }}>
            {latestTemp?.toFixed(1) ?? "--"}°C
          </div>
        </div>
        <div style={{ background: "#1a1a2e", borderRadius: 8, padding: "1rem", textAlign: "center" }}>
          <div style={{ color: "#888", fontSize: "0.85rem" }}>重量</div>
          <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#22c55e" }}>
            {latestWeight?.toFixed(1) ?? "--"} g
          </div>
        </div>
      </div>

      {/* Real-time chart */}
      <div style={{ background: "#1a1a2e", borderRadius: 8, padding: "1rem" }}>
        <ShotChart data={data} height={400} />
      </div>

      {/* Stop button */}
      <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
        {running ? (
          <button
            onClick={() => setRunning(false)}
            style={{
              padding: "1rem 3rem",
              borderRadius: 8,
              border: "none",
              background: "#ef4444",
              color: "#fff",
              fontSize: "1.2rem",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            ストップ
          </button>
        ) : (
          <p style={{ color: "#22c55e", fontSize: "1.2rem" }}>
            抽出完了 - {elapsed}秒 / {latestWeight?.toFixed(1)}g
          </p>
        )}
      </div>
    </div>
  );
}
