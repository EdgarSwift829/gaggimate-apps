import { useState } from "react";
import StarRating from "../components/StarRating";
import ShotChart from "../components/ShotChart";
import type { TimeseriesPoint, Bean } from "../types";

// Mock shot data
const mockTimeseries: TimeseriesPoint[] = Array.from({ length: 28 }, (_, i) => ({
  t: i + 1,
  pressure: i < 5 ? 2 + Math.random() * 1.5 : 8.5 + Math.sin(i * 0.3) * 0.8,
  temp: 92.5 + Math.sin(i * 0.2) * 1.5,
  weight: Math.max(0, (i - 3) * 1.2),
  flow: i < 5 ? 0.5 : 1.8 + Math.sin(i * 0.5) * 0.4,
}));

const mockBeans: Bean[] = [
  { id: 1, name: "Ethiopia Yirgacheffe", roaster: "Onibus", roast_date: "2025-03-20", origin: "Ethiopia", notes: null, created_at: "" },
  { id: 2, name: "Colombia Huila", roaster: "Fuglen", roast_date: "2025-03-18", origin: "Colombia", notes: null, created_at: "" },
];

const inputStyle = {
  width: "100%",
  padding: "0.5rem",
  borderRadius: 6,
  border: "1px solid #333",
  background: "#16213e",
  color: "#fff",
  fontSize: "0.95rem",
  boxSizing: "border-box" as const,
};

export default function PostShot() {
  const [beanId, setBeanId] = useState<number | "">(1);
  const [doseG, setDoseG] = useState("18.0");
  const [clicks, setClicks] = useState("22");
  const [feedback, setFeedback] = useState("");
  const [score, setScore] = useState(0);
  const [saved, setSaved] = useState(false);
  const [suggestion, setSuggestion] = useState("");

  const handleSave = () => {
    setSaved(true);
    // Mock LLM suggestion
    setTimeout(() => {
      setSuggestion(
        "## 改善提案\n\n" +
        "1. **グラインドを1クリック細かく（21クリック）**に調整してください。抽出時間が28秒で、もう少し抵抗を加えることで甘みが増します。\n\n" +
        "2. **温度を93.5°Cに上げる**と、このエチオピアのフルーティーなフレーバーがより引き出されます。\n\n" +
        "3. プレインフュージョンの時間は適切です。現在のプロファイルを維持してください。"
      );
    }, 1500);
  };

  return (
    <div style={{ color: "#fff" }}>
      <h1>抽出結果</h1>

      {/* Summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        {[
          { label: "抽出時間", value: "28s" },
          { label: "収量", value: "36.2g" },
          { label: "比率", value: "1:2.01" },
          { label: "ピーク圧力", value: "9.1 bar" },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: "#1a1a2e", borderRadius: 8, padding: "1rem", textAlign: "center" }}>
            <div style={{ color: "#888", fontSize: "0.85rem" }}>{label}</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ background: "#1a1a2e", borderRadius: 8, padding: "1rem", marginBottom: "1.5rem" }}>
        <ShotChart data={mockTimeseries} />
      </div>

      {/* Feedback Form */}
      <div style={{ background: "#1a1a2e", borderRadius: 8, padding: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>フィードバック</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label style={{ color: "#888", fontSize: "0.85rem" }}>豆</label>
            <select
              value={beanId}
              onChange={(e) => setBeanId(e.target.value ? Number(e.target.value) : "")}
              style={inputStyle}
            >
              <option value="">新しい豆を追加...</option>
              {mockBeans.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.roaster})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ color: "#888", fontSize: "0.85rem" }}>ドーズ (g)</label>
            <input type="number" step="0.1" value={doseG} onChange={(e) => setDoseG(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ color: "#888", fontSize: "0.85rem" }}>コマンダンテ クリック数</label>
            <input type="number" value={clicks} onChange={(e) => setClicks(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ color: "#888", fontSize: "0.85rem" }}>スコア</label>
            <div style={{ marginTop: "0.25rem" }}>
              <StarRating value={score} onChange={setScore} />
            </div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ color: "#888", fontSize: "0.85rem" }}>感想</label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="例: 酸っぱかった、苦みが強い、甘みが出た..."
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
        </div>
        <div style={{ marginTop: "1rem", textAlign: "right" }}>
          <button
            onClick={handleSave}
            disabled={saved}
            style={{
              padding: "0.75rem 2rem",
              borderRadius: 6,
              border: "none",
              background: saved ? "#555" : "#e94560",
              color: "#fff",
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: saved ? "default" : "pointer",
            }}
          >
            {saved ? "保存済み" : "保存してLLM分析"}
          </button>
        </div>
      </div>

      {/* LLM Suggestion */}
      {suggestion && (
        <div style={{ background: "#16213e", borderRadius: 8, padding: "1.5rem", marginTop: "1.5rem", border: "1px solid #e94560" }}>
          <h2 style={{ marginTop: 0, color: "#e94560" }}>AI改善提案</h2>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>{suggestion}</div>
        </div>
      )}
    </div>
  );
}
