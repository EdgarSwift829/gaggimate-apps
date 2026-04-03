"""LLM連携 REST API（接続テスト・提案取得）."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.services.llm import client as llm_client, get_improvement_suggestion, generate_recipe_suggestion
from app.services.analysis import analyze_shot
from app.database import get_db

logger = logging.getLogger("llm_api")
router = APIRouter(prefix="/api/llm", tags=["llm"])


@router.get("/test")
async def test_llm_connection():
    """LM Studio接続テスト — モデル一覧を取得して接続確認."""
    try:
        models = await llm_client.models.list()
        model_list = [m.id for m in models.data]
        return {
            "connected": True,
            "base_url": settings.lm_studio_base_url,
            "configured_model": settings.lm_studio_model,
            "available_models": model_list,
        }
    except Exception as e:
        return {
            "connected": False,
            "base_url": settings.lm_studio_base_url,
            "error": str(e),
        }


class SuggestRequest(BaseModel):
    shot_id: int
    extra_feedback: str | None = None


@router.post("/suggest")
async def suggest_improvement(body: SuggestRequest):
    """指定ショットに対してLLM改善提案を生成."""
    db = await get_db()
    try:
        # ショット取得
        row = await db.execute(
            """SELECT s.*, b.name as bean_name
               FROM shots s LEFT JOIN beans b ON s.bean_id = b.id
               WHERE s.id = ?""",
            [body.shot_id],
        )
        shot = await row.fetchone()
        if not shot:
            raise HTTPException(404, "Shot not found")
        shot = dict(shot)

        # 時系列取得
        ts_rows = await db.execute(
            "SELECT t, pressure, temp, weight, flow FROM shot_timeseries WHERE shot_id = ? ORDER BY t",
            [body.shot_id],
        )
        timeseries = [dict(r) for r in await ts_rows.fetchall()]

        # グラインド情報
        grind_row = await db.execute(
            "SELECT clicks, dose_g, yield_g FROM grind_settings WHERE shot_id = ?",
            [body.shot_id],
        )
        grind = await grind_row.fetchone()
        grind_clicks = dict(grind)["clicks"] if grind else None
        dose_g = dict(grind)["dose_g"] if grind else shot.get("dose_g", 18.0)

        # 数値分析
        analysis = analyze_shot(timeseries, dose_g=dose_g or 18.0, yield_g=shot.get("yield_g"))

        # フィードバック
        feedback = body.extra_feedback or shot.get("feedback", "")

        # 過去ショット
        past_summary = None
        if shot.get("bean_id"):
            past_rows = await db.execute(
                """SELECT duration, yield_ratio, score, feedback
                   FROM shots WHERE bean_id = ? AND id != ? ORDER BY timestamp DESC LIMIT 5""",
                [shot["bean_id"], body.shot_id],
            )
            past = [dict(r) for r in await past_rows.fetchall()]
            if past:
                past_summary = "\n".join(
                    f"- {p['duration']}秒 / {p['yield_ratio']}x / ★{p['score']} / {p['feedback']}"
                    for p in past if p.get("duration")
                )

        # LLM呼び出し
        suggestion = await get_improvement_suggestion(
            analysis=analysis,
            feedback=feedback,
            grind_clicks=grind_clicks,
            bean_info=shot.get("bean_name"),
            past_shots_summary=past_summary,
        )

        # 提案をDB保存
        await db.execute(
            "INSERT INTO llm_suggestions (shot_id, prompt, response, model) VALUES (?, ?, ?, ?)",
            [body.shot_id, feedback, suggestion, settings.lm_studio_model],
        )
        await db.commit()

        return {
            "shot_id": body.shot_id,
            "suggestion": suggestion,
            "analysis": {
                "duration": analysis.duration,
                "yield_ratio": analysis.yield_ratio,
                "avg_pressure": analysis.avg_pressure,
                "peak_pressure": analysis.peak_pressure,
                "flags": analysis.flags,
            },
        }
    finally:
        await db.close()


@router.get("/suggestions/{shot_id}")
async def get_suggestions(shot_id: int):
    """指定ショットのLLM提案履歴を取得."""
    db = await get_db()
    try:
        rows = await db.execute(
            "SELECT * FROM llm_suggestions WHERE shot_id = ? ORDER BY created_at DESC",
            [shot_id],
        )
        return [dict(r) for r in await rows.fetchall()]
    finally:
        await db.close()
