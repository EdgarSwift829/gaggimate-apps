const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ── Shots ──────────────────────────────────────────
export const getShots = (params?: { bean_id?: number; recipe_id?: number }) => {
  const qs = new URLSearchParams();
  if (params?.bean_id) qs.set("bean_id", String(params.bean_id));
  if (params?.recipe_id) qs.set("recipe_id", String(params.recipe_id));
  const q = qs.toString();
  return request<any[]>(`/shots${q ? `?${q}` : ""}`);
};

export const getShot = (id: number) => request<any>(`/shots/${id}`);

export const createShot = (data: any) =>
  request<any>("/shots", { method: "POST", body: JSON.stringify(data) });

export const updateFeedback = (id: number, data: any) =>
  request<any>(`/shots/${id}/feedback`, { method: "PUT", body: JSON.stringify(data) });

// ── Beans ──────────────────────────────────────────
export const getBeans = (q?: string) =>
  request<any[]>(`/beans${q ? `?q=${encodeURIComponent(q)}` : ""}`);

export const createBean = (data: any) =>
  request<any>("/beans", { method: "POST", body: JSON.stringify(data) });

// ── Recipes ────────────────────────────────────────
export const getRecipes = (params?: {
  favorites_only?: boolean;
  sort_by?: string;
  bean_id?: number;
}) => {
  const qs = new URLSearchParams();
  if (params?.favorites_only) qs.set("favorites_only", "true");
  if (params?.sort_by) qs.set("sort_by", params.sort_by);
  if (params?.bean_id) qs.set("bean_id", String(params.bean_id));
  const q = qs.toString();
  return request<any[]>(`/recipes${q ? `?${q}` : ""}`);
};

export const createRecipe = (data: any) =>
  request<any>("/recipes", { method: "POST", body: JSON.stringify(data) });

export const toggleFavorite = (id: number) =>
  request<any>(`/recipes/${id}/favorite`, { method: "POST" });

// ── LLM ────────────────────────────────────────────
export const getSuggestion = (shotId: number) =>
  request<any>("/llm/suggest", {
    method: "POST",
    body: JSON.stringify({ shot_id: shotId }),
  });

export const getSuggestions = (shotId: number) =>
  request<any[]>(`/llm/suggestions/${shotId}`);

export const getRecipeSuggestion = (data: any) =>
  request<any>("/llm/recipe", { method: "POST", body: JSON.stringify(data) });

// ── GaggiMate ──────────────────────────────────────
export const getMachineState = () => request<any>("/gaggimate/state");

export const brewCommand = (action: string, recipe_id?: number) =>
  request<any>("/gaggimate/brew", {
    method: "POST",
    body: JSON.stringify({ action, recipe_id }),
  });
