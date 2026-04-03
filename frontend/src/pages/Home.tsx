import { useState } from "react";
import type { MachineState, Recipe } from "../types";

// Mock data for Phase 1
const mockState: MachineState = {
  temperature: 93.2,
  pressure: 0,
  weight: null,
  flow: null,
  status: "idle",
};

const mockRecipes: Recipe[] = [
  {
    id: 1, name: "Classic Espresso 9bar", json: "{}", version: 1,
    is_favorite: true, avg_score: 4.2, use_count: 15, created_at: "2025-01-01",
  },
  {
    id: 2, name: "Turbo Shot", json: "{}", version: 2,
    is_favorite: false, avg_score: 3.8, use_count: 8, created_at: "2025-01-15",
  },
  {
    id: 3, name: "Blooming Espresso", json: "{}", version: 1,
    is_favorite: true, avg_score: 4.5, use_count: 22, created_at: "2025-02-01",
  },
];

export default function Home() {
  const [state] = useState<MachineState>(mockState);
  const [recipes] = useState<Recipe[]>(mockRecipes);
  const [selectedRecipe, setSelectedRecipe] = useState<number>(mockRecipes[0].id);

  const statusColor: Record<string, string> = {
    idle: "#22c55e",
    brewing: "#f59e0b",
    steaming: "#0ea5e9",
    disconnected: "#ef4444",
  };

  return (
    <div style={{ color: "#fff" }}>
      <h1>ホーム</h1>

      {/* Machine Status */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <div style={{ background: "#1a1a2e", borderRadius: 8, padding: "1.5rem", textAlign: "center" }}>
          <div style={{ color: "#888", fontSize: "0.85rem" }}>温度</div>
          <div style={{ fontSize: "2.5rem", fontWeight: "bold", color: "#e94560" }}>
            {state.temperature?.toFixed(1) ?? "--"}°C
          </div>
        </div>
        <div style={{ background: "#1a1a2e", borderRadius: 8, padding: "1.5rem", textAlign: "center" }}>
          <div style={{ color: "#888", fontSize: "0.85rem" }}>圧力</div>
          <div style={{ fontSize: "2.5rem", fontWeight: "bold", color: "#0ea5e9" }}>
            {state.pressure?.toFixed(1) ?? "--"} bar
          </div>
        </div>
        <div style={{ background: "#1a1a2e", borderRadius: 8, padding: "1.5rem", textAlign: "center" }}>
          <div style={{ color: "#888", fontSize: "0.85rem" }}>ステータス</div>
          <div
            style={{
              fontSize: "1.5rem",
              fontWeight: "bold",
              color: statusColor[state.status] || "#888",
              textTransform: "uppercase",
            }}
          >
            {state.status}
          </div>
        </div>
      </div>

      {/* Recipe Selection & Start */}
      <div style={{ background: "#1a1a2e", borderRadius: 8, padding: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>抽出開始</h2>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <select
            value={selectedRecipe}
            onChange={(e) => setSelectedRecipe(Number(e.target.value))}
            style={{
              flex: 1,
              padding: "0.75rem",
              borderRadius: 6,
              border: "1px solid #333",
              background: "#16213e",
              color: "#fff",
              fontSize: "1rem",
            }}
          >
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.is_favorite ? "♥ " : ""}{r.name} (v{r.version})
              </option>
            ))}
          </select>
          <button
            style={{
              padding: "0.75rem 2rem",
              borderRadius: 6,
              border: "none",
              background: state.status === "idle" ? "#e94560" : "#555",
              color: "#fff",
              fontSize: "1.1rem",
              fontWeight: "bold",
              cursor: state.status === "idle" ? "pointer" : "not-allowed",
            }}
            disabled={state.status !== "idle"}
          >
            スタート
          </button>
        </div>
      </div>
    </div>
  );
}
