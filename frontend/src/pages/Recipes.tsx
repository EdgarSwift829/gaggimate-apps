import { useEffect, useState } from "react";
import { getRecipes, toggleFavorite, customizeRecipe, type Recipe } from "../api";

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [sort, setSort] = useState("created_at");
  const [favOnly, setFavOnly] = useState(false);
  const [customizeText, setCustomizeText] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => getRecipes(sort, favOnly).then(setRecipes).catch(() => {});

  useEffect(() => { load(); }, [sort, favOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFav = async (id: number) => {
    await toggleFavorite(id);
    load();
  };

  const handleCustomize = async () => {
    if (!customizeText.trim()) return;
    setLoading(true);
    try {
      const res = await customizeRecipe(customizeText);
      setSuggestion(res.suggestion);
    } catch {
      setSuggestion("LLM接続エラー");
    }
    setLoading(false);
  };

  return (
    <div>
      <h1 className="mb-24">レシピ</h1>

      <div className="flex gap-16 items-center mb-16">
        <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ padding: "6px 12px", background: "var(--surface)", color: "var(--text)", border: "1px solid #444", borderRadius: "var(--radius)" }}>
          <option value="created_at">作成日順</option>
          <option value="avg_score">評価順</option>
          <option value="use_count">使用頻度順</option>
        </select>
        <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
          <input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} />
          お気に入りのみ
        </label>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>レシピ名</th>
              <th>バージョン</th>
              <th>平均スコア</th>
              <th>使用回数</th>
              <th>作成日</th>
            </tr>
          </thead>
          <tbody>
            {recipes.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)" }}>レシピがありません</td></tr>
            )}
            {recipes.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className={`fav ${r.is_favorite ? "on" : "off"}`} onClick={() => handleFav(r.id)}>
                    ★
                  </span>
                </td>
                <td>{r.name}</td>
                <td>v{r.version}</td>
                <td>{r.avg_score?.toFixed(1) ?? "-"}</td>
                <td>{r.use_count}</td>
                <td>{r.created_at?.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* LLMカスタマイズ */}
      <div className="card">
        <h3>LLMにレシピカスタマイズを依頼</h3>
        <div className="form-group">
          <textarea
            value={customizeText}
            onChange={(e) => setCustomizeText(e.target.value)}
            placeholder='例: 「このエチオピアに合うレシピ作って」「甘みをもっと出したい」'
          />
        </div>
        <button className="btn btn-primary" onClick={handleCustomize} disabled={loading}>
          {loading ? "生成中..." : "提案を生成"}
        </button>
        {suggestion && (
          <div className="suggestion" style={{ marginTop: 16 }}>{suggestion}</div>
        )}
      </div>
    </div>
  );
}
