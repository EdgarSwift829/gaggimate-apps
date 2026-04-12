import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { connectStatusWS, startBrew, getRecipes, type MachineStatus, type Recipe } from "../api";

export default function Home() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<MachineStatus | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = connectStatusWS((data) => {
      setStatus(data);
      setConnected(true);
    });
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    getRecipes().then(setRecipes).catch((e) => { console.error("getRecipes failed:", e); });
    return () => ws.close();
  }, []);

  const handleStart = async () => {
    try {
      // 選択レシピの stop_on_weight を localStorage に保存して Brewing.tsx で参照する
      const recipe = recipes.find((r) => r.id === selectedRecipe) ?? null;
      if (recipe) {
        try {
          const profileJson = JSON.parse(recipe.json) as { stop_on_weight?: number };
          const stopOnWeight = profileJson.stop_on_weight ?? 0;
          localStorage.setItem("brew_stop_on_weight", String(stopOnWeight));
        } catch {
          localStorage.removeItem("brew_stop_on_weight");
        }
      } else {
        localStorage.removeItem("brew_stop_on_weight");
      }

      await startBrew();
      navigate("/brewing");
    } catch (e) {
      alert("抽出開始に失敗しました");
    }
  };

  const mode = status?.mode ?? "unknown";
  const tempReady = status ? Math.abs(status.current_temp - status.target_temp) < 2 : false;

  return (
    <div>
      <div className="flex justify-between items-center mb-24">
        <h1>ホーム</h1>
        <span className={`badge badge-${mode === "brew" ? "brew" : "standby"}`}>
          {connected ? mode.toUpperCase() : "DISCONNECTED"}
        </span>
      </div>

      <div className="status-grid">
        <div className="stat">
          <div className="value">{status?.current_temp?.toFixed(1) ?? "--"}°C</div>
          <div className="label">ボイラー温度</div>
        </div>
        <div className="stat">
          <div className="value">{status?.target_temp?.toFixed(0) ?? "--"}°C</div>
          <div className="label">目標温度</div>
        </div>
        <div className="stat">
          <div className="value">{status?.pressure?.toFixed(1) ?? "--"}</div>
          <div className="label">圧力 (bar)</div>
        </div>
        <div className="stat">
          <div className="value" style={{ color: tempReady ? "#2ecc71" : "#e74c3c" }}>
            {tempReady ? "READY" : "HEATING"}
          </div>
          <div className="label">ステータス</div>
        </div>
      </div>

      <div className="card">
        <h3>レシピ選択</h3>
        <div className="form-group">
          <select
            value={selectedRecipe ?? ""}
            onChange={(e) => setSelectedRecipe(Number(e.target.value) || null)}
          >
            <option value="">選択してください</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleStart}
          disabled={mode === "brew" || !connected}
          style={{ width: "100%", fontSize: 18, padding: "16px" }}
        >
          {mode === "brew" ? "抽出中..." : "抽出開始"}
        </button>
      </div>
    </div>
  );
}
