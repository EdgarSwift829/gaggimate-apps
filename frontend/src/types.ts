export interface Bean {
  id: number;
  name: string;
  roaster: string | null;
  roast_date: string | null;
  origin: string | null;
  notes: string | null;
  created_at: string;
}

export interface TimeseriesPoint {
  t: number;
  pressure: number | null;
  temp: number | null;
  weight: number | null;
  flow: number | null;
}

export interface GrindSettings {
  id?: number;
  shot_id?: number;
  clicks: number | null;
  dose_g: number | null;
  yield_g: number | null;
}

export interface Shot {
  id: number;
  timestamp: string;
  duration: number | null;
  recipe_id: number | null;
  bean_id: number | null;
  score: number | null;
  feedback: string | null;
  yield_g: number | null;
  created_at: string;
}

export interface ShotDetail extends Shot {
  timeseries: TimeseriesPoint[];
  grind: GrindSettings | null;
}

export interface Recipe {
  id: number;
  name: string;
  json: string;
  version: number;
  is_favorite: boolean;
  avg_score: number | null;
  use_count: number;
  created_at: string;
}

export interface MachineState {
  temperature: number | null;
  pressure: number | null;
  weight: number | null;
  flow: number | null;
  status: string;
}

export interface LLMSuggestion {
  id: number;
  shot_id: number;
  prompt: string;
  response: string;
  created_at: string;
}
