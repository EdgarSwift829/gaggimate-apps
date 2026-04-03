import StarRating from "./StarRating";
import type { Recipe } from "../types";

interface Props {
  recipe: Recipe;
  onToggleFavorite: (id: number) => void;
  onSelect?: (recipe: Recipe) => void;
}

export default function RecipeCard({ recipe, onToggleFavorite, onSelect }: Props) {
  return (
    <div
      style={{
        background: "#1a1a2e",
        borderRadius: 8,
        padding: "1rem",
        border: "1px solid #333",
        cursor: onSelect ? "pointer" : "default",
      }}
      onClick={() => onSelect?.(recipe)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, color: "#fff" }}>{recipe.name}</h3>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(recipe.id);
          }}
          style={{
            background: "none",
            border: "none",
            fontSize: "1.3rem",
            cursor: "pointer",
            color: recipe.is_favorite ? "#e94560" : "#555",
          }}
        >
          {recipe.is_favorite ? "♥" : "♡"}
        </button>
      </div>
      <div style={{ color: "#888", fontSize: "0.85rem", marginTop: "0.5rem" }}>
        <span>v{recipe.version}</span>
        <span style={{ margin: "0 0.5rem" }}>|</span>
        <span>使用回数: {recipe.use_count}</span>
      </div>
      {recipe.avg_score !== null && (
        <div style={{ marginTop: "0.5rem" }}>
          <StarRating value={Math.round(recipe.avg_score)} readonly />
          <span style={{ color: "#888", fontSize: "0.85rem", marginLeft: "0.5rem" }}>
            ({recipe.avg_score.toFixed(1)})
          </span>
        </div>
      )}
    </div>
  );
}
