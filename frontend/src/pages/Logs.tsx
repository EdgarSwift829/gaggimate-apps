import { useState } from "react";
import ShotChart from "../components/ShotChart";
import StarRating from "../components/StarRating";
import type { Shot, TimeseriesPoint } from "../types";

// Mock data
const mockShots: (Shot & { bean_name?: string; recipe_name?: string })[] = [
  { id: 5, timestamp: "2025-03-28 09:15", duration: 28, recipe_id: 1, bean_id: 1, score: 4, feedback: "バランス良い。甘み出た。", yield_g: 36.2, created_at: "", bean_name: "Ethiopia Yirgacheffe", recipe_name: "Classic Espresso 9bar" },
  { id: 4, timestamp: "2025-03-27 08:45", duration: 22, recipe_id: 2, bean_id: 1, score: 3, feedback: "少し酸っぱい。グラインド細かくすべき。", yield_g: 30.1, created_at: "", bean_name: "Ethiopia Yirgacheffe", recipe_name: "Turbo Shot" },
  { id: 3, timestamp: "2025-03-26 09:00", duration: 32, recipe_id: 1, bean_id: 2, score: 5, feedback: "完璧。チョコレート感が出た。", yield_g: 38.5, created_at: "", bean_name: "Colombia Huila", recipe_name: "Classic Espresso 9bar" },
  { id: 2, timestamp: "2025-03-25 08:30", duration: 19, recipe_id: 3, bean_id: 2, score: 2, feedback: "水っぽい。ドーズ不足？", yield_g: 42.0, created_at: "", bean_name: "Colombia Huila", recipe_name: "Blooming Espresso" },
  { id: 1, timestamp: "2025-03-24 09:10", duration: 26, recipe_id: 1, bean_id: 1, score: 4, feedback: "良い。少し苦みが強い。", yield_g: 34.8, created_at: "", bean_name: "Ethiopia Yirgacheffe", recipe_name: "Classic Espresso 9bar" },
];

function generateMockTimeseries(duration: number): TimeseriesPoint[] {
  return Array.from({ length: duration }, (_, i) => ({
    t: i + 1,
    pressure: i < 5 ? 2 + Math.random() * 1.5 : 8.5 + Math.sin(i * 0.3) * 0.8,
    temp: 92.5 + Math.sin(i * 0.2) * 1.5,
    weight: Math.max(0, (i - 3) * 1.2),
    flow: i < 5 ? 0.5 : 1.8 + Math.sin(i * 0.5) * 0.4,
  }));
}

export default function Logs() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [beanFilter, setBeanFilter] = useState<string>("");

  const filtered = beanFilter
    ? mockShots.filter((s) => s.bean_name?.includes(beanFilter))
    : mockShots;

  return (
    <div style={{ color: "#fff" }}>
      <h1>ショットログ</h1>

      {/* Filters */}
      <div style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          value={beanFilter}
          onChange={(e) => setBeanFilter(e.target.value)}
          placeholder="豆の名前でフィルター..."
          style={{
            padding: "0.5rem 1rem",
            borderRadius: 6,
            border: "1px solid #333",
            background: "#16213e",
            color: "#fff",
            width: 300,
          }}
        />
      </div>

      {/* Shot List */}
      <div style={{ background: "#1a1a2e", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #333" }}>
              {["日時", "豆", "レシピ", "時間", "収量", "スコア", ""].map((h) => (
                <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", color: "#888", fontWeight: "normal", fontSize: "0.85rem" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((shot) => (
              <>
                <tr
                  key={shot.id}
                  onClick={() => setExpandedId(expandedId === shot.id ? null : shot.id)}
                  style={{ borderBottom: "1px solid #222", cursor: "pointer" }}
                >
                  <td style={{ padding: "0.75rem 1rem" }}>{shot.timestamp}</td>
                  <td style={{ padding: "0.75rem 1rem" }}>{shot.bean_name}</td>
                  <td style={{ padding: "0.75rem 1rem" }}>{shot.recipe_name}</td>
                  <td style={{ padding: "0.75rem 1rem" }}>{shot.duration}s</td>
                  <td style={{ padding: "0.75rem 1rem" }}>{shot.yield_g}g</td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <StarRating value={shot.score ?? 0} readonly />
                  </td>
                  <td style={{ padding: "0.75rem 1rem", color: "#888" }}>
                    {expandedId === shot.id ? "▲" : "▼"}
                  </td>
                </tr>
                {expandedId === shot.id && (
                  <tr key={`${shot.id}-detail`}>
                    <td colSpan={7} style={{ padding: "1rem", background: "#16213e" }}>
                      <div style={{ marginBottom: "1rem" }}>
                        <strong>感想:</strong> {shot.feedback}
                      </div>
                      <ShotChart data={generateMockTimeseries(shot.duration ?? 25)} height={250} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
