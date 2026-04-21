const API_BASE = `http://${window.location.hostname}:8005`;

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// --- Types ---
export interface Shot {
  id: number;
  timestamp: string;
  duration: number | null;
  dose_g: number | null;
  yield_g: number | null;
  yield_ratio: number | null;
  score: number | null;
  feedback: string | null;
  bean_name: string | null;
  recipe_name: string | null;
}

export interface TimeseriesPoint {
  t: number;
  pressure: number | null;
  temp: number | null;
  weight: number | null;
  flow: number | null;
}

export interface ShotDetail extends Shot {
  timeseries: TimeseriesPoint[];
  grind: {
    clicks: number | null;
    dose_g: number | null;
    yield_g: number | null;
  } | null;
  suggestion?: string | null;
  bean_id?: number | null;
  recipe_id?: number | null;
}

export interface Bean {
  id: number;
  name: string;
  roaster: string | null;
  roast_date: string | null;
  origin: string | null;
  notes: string | null;
}

export interface Recipe {
  id: number;
  name: string;
  json: string;
  version: number;
  is_favorite: number;  // SQLite returns 0 or 1
  is_community?: number;  // SQLite returns 0 or 1
  is_archived?: number;  // SQLite returns 0 or 1
  archived_at?: string | null;
  avg_score: number | null;
  use_count: number;
  created_at: string;
  source?: string | null;
}

export interface MachineStatus {
  tp: string;
  current_temp: number;
  target_temp: number;
  pressure: number;
  flow: number;
  mode: string;
  weight: number;
  phase: string;
  elapsed_time: number;
  pumping: boolean;
  supports_pressure_control?: boolean;
  supports_dimming?: boolean;
}

// --- Shots ---
export const getShots = (limit = 50, beanId?: number, recipeId?: number) => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (beanId) params.set("bean_id", String(beanId));
  if (recipeId) params.set("recipe_id", String(recipeId));
  return fetchJSON<Shot[]>(`/api/shots?${params}`);
};
export const getShot = (id: number) => fetchJSON<ShotDetail>(`/api/shots/${id}`);
export const getTimeseries = (id: number) => fetchJSON<TimeseriesPoint[]>(`/api/shots/${id}/timeseries`);
export const saveFeedback = (shotId: number, data: Record<string, unknown>) =>
  fetchJSON(`/api/shots/${shotId}/feedback`, { method: "POST", body: JSON.stringify(data) });

// --- Beans ---
export const getBeans = () => fetchJSON<Bean[]>("/api/beans");
export const createBean = (data: Partial<Bean>) =>
  fetchJSON<Bean>("/api/beans", { method: "POST", body: JSON.stringify(data) });

// --- Recipes ---
export const getRecipes = (sort = "created_at", favOnly = false, status = "active", community?: boolean) => {
  const params = new URLSearchParams({ sort, favorites_only: String(favOnly), status });
  if (community !== undefined) params.set("community", String(community));
  return fetchJSON<Recipe[]>(`/api/recipes?${params}`);
};
export const createRecipe = (data: { name: string; json: string }) =>
  fetchJSON<Recipe>("/api/recipes", { method: "POST", body: JSON.stringify({ name: data.name, profile_json: data.json }) });
export const toggleFavorite = (id: number) =>
  fetchJSON(`/api/recipes/${id}/favorite`, { method: "PATCH" });
export const toggleArchive = (id: number) =>
  fetchJSON<{ id: number; is_archived: boolean; archived_at: string | null }>(`/api/recipes/${id}/archive`, { method: "PATCH" });
export const customizeRecipe = (request: string, baseId?: number) =>
  fetchJSON<{ suggestion: string }>("/api/recipes/customize", {
    method: "POST",
    body: JSON.stringify({ request, base_recipe_id: baseId }),
  });
export const updateRecipe = (id: number, data: { name?: string; profile_json?: string; is_favorite?: boolean }) =>
  fetchJSON<Recipe>(`/api/recipes/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteRecipe = (id: number, force = false) =>
  fetchJSON<{ ok: boolean; archived: boolean }>(`/api/recipes/${id}${force ? "?force=true" : ""}`, { method: "DELETE" });
export const getRecipeUsage = (id: number) =>
  fetchJSON<{ recipe_id: number; shot_count: number }>(`/api/recipes/${id}/usage`);
export const syncFromDevice = () =>
  fetchJSON<{ synced: number }>("/api/recipes/sync-from-device", { method: "POST" });
export const seedDefaultRecipes = () =>
  fetchJSON<{ created: number; skipped: number }>("/api/recipes/seed-defaults", { method: "POST" });

// --- LLM ---
export const testLLM = () => fetchJSON<{ connected: boolean; base_url: string; available_models?: string[]; error?: string }>("/api/llm/test");
export const suggestImprovement = (shotId: number, extraFeedback?: string) =>
  fetchJSON<{ suggestion: string; analysis: Record<string, unknown> }>("/api/llm/suggest", {
    method: "POST",
    body: JSON.stringify({ shot_id: shotId, extra_feedback: extraFeedback }),
  });
export const getLLMSuggestions = (shotId: number) =>
  fetchJSON<Array<{ id: number; response: string; created_at: string }>>(`/api/llm/suggestions/${shotId}`);

// --- Machine ---
export const getHealth = () => fetchJSON<{ status: string; gaggimate_connected: boolean }>("/api/health");
export const startBrew = () => fetchJSON("/api/machine/brew/start", { method: "POST" });
export const stopBrew = () => fetchJSON("/api/machine/brew/stop", { method: "POST" });

// --- Analytics ---
export const getDashboard = () => fetchJSON<any>("/api/analytics/dashboard");
export const compareShots = (ids: number[]) => fetchJSON<any>(`/api/analytics/compare?shot_ids=${ids.join(",")}`);
export const getTrends = (groupBy: string) => fetchJSON<any>(`/api/analytics/trends?group_by=${groupBy}`);

// --- Recipe AI ---
export const generateRecipe = (data: any) => fetchJSON<any>("/api/recipes/ai/generate", { method: "POST", body: JSON.stringify(data) });
export const chatRecipe = (data: any) => fetchJSON<any>("/api/recipes/ai/chat", { method: "POST", body: JSON.stringify(data) });
export const importRecipe = (data: { name: string; recipe_json: unknown }) =>
  fetchJSON<unknown>("/api/recipes/import", {
    method: "POST",
    body: JSON.stringify({ name: data.name, json_text: JSON.stringify(data.recipe_json) }),
  });

export const importRecipeRaw = (data: { name: string; json_text: string; source?: string }) =>
  fetchJSON<unknown>("/api/recipes/import", {
    method: "POST",
    body: JSON.stringify(data),
  });

// --- Settings ---
export interface Settings {
  gaggimate_host: string;
  gaggimate_ws_port: number;
  lm_studio_base_url: string;
  lm_studio_model: string;
  line_notify_token: string | null;
}

export const getSettings = () => fetchJSON<Settings>("/api/settings");
export const saveSettings = (data: Settings) =>
  fetchJSON<Settings>("/api/settings", { method: "PUT", body: JSON.stringify(data) });

// --- WebSocket ---
export function connectStatusWS(onMessage: (data: MachineStatus) => void): WebSocket {
  const ws = new WebSocket(`ws://${window.location.hostname}:8005/ws/status`);
  ws.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data));
    } catch { /* ignore */ }
  };
  return ws;
}
