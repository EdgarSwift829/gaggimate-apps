"""LLM integration API: shot suggestions and recipe customization."""

import json
from fastapi import APIRouter, Depends, HTTPException
import aiosqlite

from ..database import get_db
from ..models import LLMSuggestionRequest, LLMSuggestionOut, LLMRecipeRequest, LLMRecipeResponse
from ..services.analysis import analyze_shot
from ..services.llm_service import get_shot_suggestion, get_recipe_suggestion
from ..models import TimeseriesPoint

router = APIRouter(prefix="/llm", tags=["llm"])


@router.post("/suggest", response_model=LLMSuggestionOut)
async def suggest_improvement(
    req: LLMSuggestionRequest,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Analyze a shot and get LLM improvement suggestion."""
    # Fetch shot
    cursor = await db.execute("SELECT * FROM shots WHERE id = ?", [req.shot_id])
    shot = await cursor.fetchone()
    if not shot:
        raise HTTPException(404, "Shot not found")
    shot = dict(shot)

    # Fetch timeseries
    cursor = await db.execute(
        "SELECT t, pressure, temp, weight, flow FROM shot_timeseries WHERE shot_id = ? ORDER BY t",
        [req.shot_id],
    )
    timeseries = [TimeseriesPoint(**dict(r)) for r in await cursor.fetchall()]

    # Fetch grind
    cursor = await db.execute("SELECT * FROM grind_settings WHERE shot_id = ?", [req.shot_id])
    grind_row = await cursor.fetchone()
    grind_info = dict(grind_row) if grind_row else None

    # Fetch bean
    bean_info = None
    if shot["bean_id"]:
        cursor = await db.execute("SELECT * FROM beans WHERE id = ?", [shot["bean_id"]])
        bean_row = await cursor.fetchone()
        if bean_row:
            bean_info = dict(bean_row)

    # Run analysis
    analysis = analyze_shot(
        timeseries=timeseries,
        duration=shot["duration"],
        dose_g=grind_info["dose_g"] if grind_info else None,
        yield_g=shot["yield_g"],
    )

    # Fetch history (same bean, last 3 shots)
    history = None
    if shot["bean_id"]:
        cursor = await db.execute(
            """SELECT s.duration, s.score, s.feedback, s.yield_g,
                      g.clicks, g.dose_g
               FROM shots s
               LEFT JOIN grind_settings g ON g.shot_id = s.id
               WHERE s.bean_id = ? AND s.id != ?
               ORDER BY s.timestamp DESC LIMIT 3""",
            [shot["bean_id"], req.shot_id],
        )
        history = [dict(r) for r in await cursor.fetchall()]

    # Build prompt
    prompt_parts = [
        f"分析結果: {json.dumps(analysis, ensure_ascii=False)}",
        f"フィードバック: {shot.get('feedback', '')}",
    ]
    if req.extra_context:
        prompt_parts.append(f"追加コンテキスト: {req.extra_context}")
    prompt = "\n".join(prompt_parts)

    # Get LLM suggestion
    response_text = await get_shot_suggestion(
        analysis=analysis,
        feedback=shot.get("feedback"),
        bean_info=bean_info,
        grind_info=grind_info,
        history=history,
    )

    # Save suggestion
    cursor = await db.execute(
        "INSERT INTO llm_suggestions (shot_id, prompt, response) VALUES (?, ?, ?)",
        [req.shot_id, prompt, response_text],
    )
    await db.commit()

    cursor = await db.execute("SELECT * FROM llm_suggestions WHERE id = ?", [cursor.lastrowid])
    return dict(await cursor.fetchone())


@router.get("/suggestions/{shot_id}", response_model=list[LLMSuggestionOut])
async def get_suggestions(shot_id: int, db: aiosqlite.Connection = Depends(get_db)):
    """Get all LLM suggestions for a shot."""
    cursor = await db.execute(
        "SELECT * FROM llm_suggestions WHERE shot_id = ? ORDER BY created_at DESC",
        [shot_id],
    )
    return [dict(r) for r in await cursor.fetchall()]


@router.post("/recipe", response_model=LLMRecipeResponse)
async def customize_recipe(
    req: LLMRecipeRequest,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Get LLM recipe suggestion/customization."""
    base_recipe = None
    if req.base_recipe_id:
        cursor = await db.execute("SELECT json FROM recipes WHERE id = ?", [req.base_recipe_id])
        row = await cursor.fetchone()
        if row:
            base_recipe = dict(row)["json"]

    bean_info = None
    if req.bean_id:
        cursor = await db.execute("SELECT * FROM beans WHERE id = ?", [req.bean_id])
        row = await cursor.fetchone()
        if row:
            bean_info = dict(row)

    # Get past shots for context
    past_shots = None
    if req.bean_id:
        cursor = await db.execute(
            """SELECT s.duration, s.score, s.feedback, s.yield_g, g.clicks, g.dose_g
               FROM shots s
               LEFT JOIN grind_settings g ON g.shot_id = s.id
               WHERE s.bean_id = ?
               ORDER BY s.timestamp DESC LIMIT 5""",
            [req.bean_id],
        )
        past_shots = [dict(r) for r in await cursor.fetchall()]

    suggestion_text, recipe_json = await get_recipe_suggestion(
        request=req.request,
        base_recipe=base_recipe,
        bean_info=bean_info,
        past_shots=past_shots,
    )

    return LLMRecipeResponse(suggestion=suggestion_text, recipe_json=recipe_json)
