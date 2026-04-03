import { useState } from "react";
import RecipeCard from "../components/RecipeCard";
import type { Recipe } from "../types";

const mockRecipes: Recipe[] = [
  {
    id: 1, name: "Classic Espresso 9bar",
    json: '{"preinfusion":{"pressure":3,"duration":5},"extraction":{"pressure":9,"duration":25}}',
    version: 1, is_favorite: true, avg_score: 4.2, use_count: 15, created_at: "2025-01-01",
  },
  {
    id: 2, name: "Turbo Shot",
    json: '{"preinfusion":{"pressure":2,"duration":3},"extraction":{"pressure":6,"duration":15}}',
    version: 2, is_favorite: false, avg_score: 3.8, use_count: 8, created_at: "2025-01-15",
  },
  {
    id: 3, name: "Blooming Espresso",
    json: '{"bloom":{"pressure":2,"duration":8},"extraction":{"pressure":9,"duration":22}}',
    version: 1, is_favorite: true, avg_score: 4.5, use_count: 22, created_at: "2025-02-01",
  },
  {
    id: 4, name: "Lungo Profile",
    json: '{"preinfusion":{"pressure":3,"duration":5},"extraction":{"pressure":7,"duration":35}}',
    version: 3, is_favorite: false, avg_score: 3.5, use_count: 5, created_at: "2025-02-10",
  },
  {
    id: 5, name: "Low Pressure Sweet",
    json: '{"preinfusion":{"pressure":2,"duration":10},"extraction":{"pressure":6,"duration":30}}',
    version: 1, is_favorite: false, avg_score: 4.0, use_count: 12, created_at: "2025-03-01",
  },
];

type SortKey = "avg_score" | "use_count" | "created_at" | "name";

export default function Recipes() {
  const [recipes, setRecipes] = useState<Recipe[]>(mockRecipes);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("avg_score");
  const [customizeRequest, setCustomizeRequest] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const filtered = recipes
    .filter((r) => !showFavoritesOnly || r.is_favorite)
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      const av = a[sortBy] ?? 0;
      const bv = b[sortBy] ?? 0;
      return (bv as number) - (av as number);
    });

  const handleToggleFavorite = (id: number) => {
    setRecipes((prev) =>
      prev.map((r) => (r.id === id ? { ...r, is_favorite: !r.is_favorite } : r))
    );
  };

  return (
    <div style={{ color: "#fff" }}>
      <h1>レシピ</h1>

      {/* Controls */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showFavoritesOnly}
            onChange={(e) => setShowFavoritesOnly(e.target.checked)}
          />
          お気に入りのみ
        </label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          style={{
            padding: "0.5rem",
            borderRadius: 6,
            border: "1px solid #333",
            background: "#16213e",
            color: "#fff",
          }}
        >
          <option value="avg_score">評価順</option>
          <option value="use_count">使用頻度順</option>
          <option value="created_at">作成日順</option>
          <option value="name">名前順</option>
        </select>
      </div>

      {/* Recipe Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        {filtered.map((r) => (
          <RecipeCard
            key={r.id}
            recipe={r}
            onToggleFavorite={handleToggleFavorite}
            onSelect={setSelectedRecipe}
          />
        ))}
      </div>

      {/* Selected recipe detail */}
      {selectedRecipe && (
        <div style={{ background: "#1a1a2e", borderRadius: 8, padding: "1.5rem", marginBottom: "1.5rem" }}>
          <h2 style={{ marginTop: 0 }}>{selectedRecipe.name} - レシピJSON</h2>
          <pre style={{ background: "#0f0f23", padding: "1rem", borderRadius: 6, overflow: "auto" }}>
            {JSON.stringify(JSON.parse(selectedRecipe.json), null, 2)}
          </pre>
        </div>
      )}

      {/* LLM Customization */}
      <div style={{ background: "#1a1a2e", borderRadius: 8, padding: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>AIレシピカスタマイズ</h2>
        <div style={{ display: "flex", gap: "1rem" }}>
          <input
            type="text"
            value={customizeRequest}
            onChange={(e) => setCustomizeRequest(e.target.value)}
            placeholder="例: 甘みをもっと出したい、このエチオピアに合うレシピ作って..."
            style={{
              flex: 1,
              padding: "0.75rem",
              borderRadius: 6,
              border: "1px solid #333",
              background: "#16213e",
              color: "#fff",
            }}
          />
          <button
            style={{
              padding: "0.75rem 1.5rem",
              borderRadius: 6,
              border: "none",
              background: "#e94560",
              color: "#fff",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            提案を取得
          </button>
        </div>
      </div>
    </div>
  );
}
