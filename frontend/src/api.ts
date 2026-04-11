const API_BASE = "http://localhost:8000";

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
  is_favorite: number;
  avg_score: number | null;
  use_count: number;
  created_at: string;
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
}

// --- Shots ---
export const getShots = (limit = 50) => fetchJSON<Shot[]>(`/api/shots?limit=${limit}`);
export const getShot = (id: number) => fetchJSON<Shot & { timeseries: TimeseriesPoint[]; grind: Record<string, number> | null }>(`/api/shots/${id}`);
export const getTimeseries = (id: number) => fetchJSON<TimeseriesPoint[]>(`/api/shots/${id}/timeseries`);
export const saveFeedback = (shotId: number, data: Record<string, unknown>) =>
  fetchJSON(`/api/shots/${shotId}/feedback`, { method: "POST", body: JSON.stringify(data) });

// --- Beans ---
export const getBeans = () => fetchJSON<Bean[]>("/api/beans");
export const createBean = (data: Partial<Bean>) =>
  fetchJSON<Bean>("/api/beans", { method: "POST", body: JSON.stringify(data) });

// --- Recipes ---
export const getRecipes = (sort = "created_at", favOnly = false) =>
  fetchJSON<Recipe[]>(`/api/recipes?sort=${sort}&favorites_only=${favOnly}`);
export const toggleFavorite = (id: number) =>
  fetchJSON(`/api/recipes/${id}/favorite`, { method: "PATCH" });
export const customizeRecipe = (request: string, baseId?: number) =>
  fetchJSON<{ suggestion: string }>("/api/recipes/customize", {
    method: "POST",
    body: JSON.stringify({ request, base_recipe_id: baseId }),
  });

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
export const importRecipe = (data: any) => fetchJSON<any>("/api/recipes/import", { method: "POST", body: JSON.stringify(data) });

// --- WebSocket ---
export function connectStatusWS(onMessage: (data: MachineStatus) => void): WebSocket {
  const ws = new WebSocket("ws://localhost:8000/ws/status");
  ws.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data));
    } catch { /* ignore */ }
  };
  return ws;
}
