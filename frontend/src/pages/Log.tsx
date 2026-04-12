import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getShots, getBeans, getRecipes, type Shot, type Bean, type Recipe } from "../api";

export default function LogPage() {
  const navigate = useNavigate();
  const [shots, setShots] = useState<Shot[]>([]);
  const [beans, setBeans] = useState<Bean[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [beanFilter, setBeanFilter] = useState<number | "">("");
  const [recipeFilter, setRecipeFilter] = useState<number | "">("");
  const [compareIds, setCompareIds] = useState<number[]>([]);

  useEffect(() => {
    getBeans().then(setBeans).catch((e) => { console.error("getBeans failed:", e); });
    getRecipes().then(setRecipes).catch((e) => { console.error("getRecipes failed:", e); });
  }, []);

  useEffect(() => {
    getShots(100, beanFilter || undefined, recipeFilter || undefined)
      .then(setShots)
      .catch((e) => { console.error("getShots failed:", e); });
  }, [beanFilter, recipeFilter]);

  const toggleCompare = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  };

  const handleCompareNavigate = () => {
    if (compareIds.length < 2) return;
    navigate(`/compare?ids=${compareIds.join(",")}`);
  };

  const selectStyle = {
    padding: "6px 12px",
    background: "var(--surface)",
    color: "var(--text)",
    border: "1px solid #444",
    borderRadius: "var(--radius)",
  };

  return (
    <div>
      <h1 className="mb-24">ショットログ</h1>

      {/* フィルター */}
      <div className="flex gap-16 items-center mb-16" style={{ flexWrap: "wrap" }}>
        <select value={beanFilter} onChange={(e) => setBeanFilter(e.target.value ? Number(e.target.value) : "")} style={selectStyle}>
          <option value="">すべての豆</option>
          {beans.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={recipeFilter} onChange={(e) => setRecipeFilter(e.target.value ? Number(e.target.value) : "")} style={selectStyle}>
          <option value="">すべてのレシピ</option>
          {recipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        {(beanFilter !== "" || recipeFilter !== "") && (
          <button
            className="btn btn-secondary"
            onClick={() => { setBeanFilter(""); setRecipeFilter(""); }}
            style={{ padding: "6px 12px", fontSize: 13 }}
          >
            クリア
          </button>
        )}
        <span style={{ color: "var(--text-muted)", fontSize: 13, marginLeft: "auto" }}>
          {shots.length}件
        </span>
      </div>

      {/* 比較ボタン */}
      {compareIds.length >= 2 && (
        <div style={{ marginBottom: 12 }}>
          <button
            className="btn btn-primary"
            onClick={handleCompareNavigate}
            style={{ padding: "8px 18px", fontSize: 14 }}
          >
            選択ショットを比較 ({compareIds.length}件)
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setCompareIds([])}
            style={{ padding: "8px 12px", fontSize: 13, marginLeft: 8 }}
          >
            選択解除
          </button>
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>比較</th>
              <th>#</th>
              <th>日時</th>
              <th>時間</th>
              <th>抽出量</th>
              <th>収率</th>
              <th>スコア</th>
              <th>豆</th>
              <th>レシピ</th>
            </tr>
          </thead>
          <tbody>
            {shots.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--text-muted)" }}>ショットデータがありません</td></tr>
            )}
            {shots.map((s) => (
              <tr
                key={s.id}
                onClick={() => navigate(`/shot/${s.id}`)}
                style={{
                  cursor: "pointer",
                  background: compareIds.includes(s.id) ? "var(--surface-hover)" : undefined,
                }}
              >
                <td onClick={(e) => toggleCompare(e, s.id)}>
                  <input
                    type="checkbox"
                    checked={compareIds.includes(s.id)}
                    onChange={() => {/* controlled via row click */}}
                    style={{ cursor: "pointer" }}
                  />
                </td>
                <td>{s.id}</td>
                <td>{s.timestamp?.slice(0, 16).replace("T", " ")}</td>
                <td>{s.duration?.toFixed(1)}s</td>
                <td>{s.yield_g?.toFixed(1) ?? "-"}g</td>
                <td>{s.yield_ratio?.toFixed(2) ?? "-"}x</td>
                <td>{s.score ? "★".repeat(s.score) : "-"}</td>
                <td>{s.bean_name ?? "-"}</td>
                <td>{s.recipe_name ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
