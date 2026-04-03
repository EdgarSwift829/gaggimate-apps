"""Pydantic models for request/response schemas."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ── Beans ──────────────────────────────────────────────

class BeanCreate(BaseModel):
    name: str
    roaster: Optional[str] = None
    roast_date: Optional[str] = None
    origin: Optional[str] = None
    notes: Optional[str] = None


class BeanOut(BeanCreate):
    id: int
    created_at: str


# ── Recipes ────────────────────────────────────────────

class RecipeCreate(BaseModel):
    name: str
    json: str  # GaggiMate recipe JSON
    version: int = 1


class RecipeUpdate(BaseModel):
    name: Optional[str] = None
    json: Optional[str] = None
    is_favorite: Optional[bool] = None


class RecipeOut(BaseModel):
    id: int
    name: str
    json: str
    version: int
    is_favorite: bool
    avg_score: Optional[float]
    use_count: int
    created_at: str


# ── Grind Settings ─────────────────────────────────────

class GrindSettingsCreate(BaseModel):
    clicks: Optional[int] = None
    dose_g: Optional[float] = None
    yield_g: Optional[float] = None


class GrindSettingsOut(GrindSettingsCreate):
    id: int
    shot_id: int


# ── Shot Timeseries ────────────────────────────────────

class TimeseriesPoint(BaseModel):
    t: float
    pressure: Optional[float] = None
    temp: Optional[float] = None
    weight: Optional[float] = None
    flow: Optional[float] = None


# ── Shots ──────────────────────────────────────────────

class ShotCreate(BaseModel):
    duration: Optional[float] = None
    recipe_id: Optional[int] = None
    bean_id: Optional[int] = None
    score: Optional[int] = Field(None, ge=1, le=5)
    feedback: Optional[str] = None
    yield_g: Optional[float] = None
    timeseries: list[TimeseriesPoint] = []
    grind: Optional[GrindSettingsCreate] = None


class ShotFeedback(BaseModel):
    bean_id: Optional[int] = None
    score: Optional[int] = Field(None, ge=1, le=5)
    feedback: Optional[str] = None
    grind: Optional[GrindSettingsCreate] = None


class ShotOut(BaseModel):
    id: int
    timestamp: str
    duration: Optional[float]
    recipe_id: Optional[int]
    bean_id: Optional[int]
    score: Optional[int]
    feedback: Optional[str]
    yield_g: Optional[float]
    created_at: str


class ShotDetail(ShotOut):
    timeseries: list[TimeseriesPoint] = []
    grind: Optional[GrindSettingsOut] = None


# ── LLM ────────────────────────────────────────────────

class LLMSuggestionRequest(BaseModel):
    shot_id: int
    extra_context: Optional[str] = None


class LLMSuggestionOut(BaseModel):
    id: int
    shot_id: int
    prompt: str
    response: str
    created_at: str


class LLMRecipeRequest(BaseModel):
    request: str  # e.g. "このエチオピアに合うレシピ作って"
    base_recipe_id: Optional[int] = None
    bean_id: Optional[int] = None


class LLMRecipeResponse(BaseModel):
    suggestion: str
    recipe_json: Optional[str] = None


# ── GaggiMate State ───────────────────────────────────

class MachineState(BaseModel):
    temperature: Optional[float] = None
    pressure: Optional[float] = None
    weight: Optional[float] = None
    flow: Optional[float] = None
    status: str = "disconnected"  # idle / brewing / steaming / disconnected


# ── WebSocket command ─────────────────────────────────

class BrewCommand(BaseModel):
    action: str  # "start" | "stop"
    recipe_id: Optional[int] = None
