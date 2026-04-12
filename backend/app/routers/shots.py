"""ショットログ REST API."""

from __future__ import annotations

import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.database import get_db
from app.services.analysis import analyze_shot
from app.services.llm import get_improvement_suggestion

router = APIRouter(prefix="/api/shots", tags=["shots"])


class ShotFeedback(BaseModel):
    bean_id: int | None = None
    bean_name: str | None = None
    dose_g: float = 18.0
    yield_g: float | None = None
    clicks: int | None = None
    score: int = Field(ge=1, le=5)
    feedback: str = ""


class ShotResponse(BaseModel):
    id: int
    timestamp: str
    duration: float | None
    dose_g: float | None
    yield_g: float | None
    yield_ratio: float | None
    score: int | None
    feedback: str | None
    recipe_name: str | None = None
    bean_name: str | None = None


@router.get("")
async def list_shots(limit: int = 50, offset: int = 0, bean_id: int | None = None, recipe_id: int | None = None):
    """ショット一覧取得."""
    db = await get_db()
    try:
        query = """
            SELECT s.*, b.name as bean_name, r.name as recipe_name
            FROM shots s
            LEFT JOIN beans b ON s.bean_id = b.id
            LEFT JOIN recipes r ON s.recipe_id = r.id
        """
        params: list = []
        conditions: list[str] = []
        if bean_id is not None:
            conditions.append("s.bean_id = ?")
            params.append(bean_id)
        if recipe_id is not None:
            conditions.append("s.recipe_id = ?")
            params.append(recipe_id)
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY s.timestamp DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        rows = await db.execute(query, params)
        results = await rows.fetchall()
        return [dict(r) for r in results]
    finally:
        await db.close()


@router.get("/{shot_id}")
async def get_shot(shot_id: int):
    """ショット詳細取得（時系列データ含む）."""
    db = await get_db()
    try:
        row = await db.execute(
            """SELECT s.*, b.name as bean_name, r.name as recipe_name
               FROM shots s
               LEFT JOIN beans b ON s.bean_id = b.id
               LEFT JOIN recipes r ON s.recipe_id = r.id
               WHERE s.id = ?""",
            [shot_id],
        )
        shot = await row.fetchone()
        if not shot:
            raise HTTPException(404, "Shot not found")

        ts_rows = await db.execute(
            "SELECT t, pressure, temp, weight, flow FROM shot_timeseries WHERE shot_id = ? ORDER BY t",
            [shot_id],
        )
        timeseries = [dict(r) for r in await ts_rows.fetchall()]

        grind_row = await db.execute(
            "SELECT clicks, dose_g, yield_g FROM grind_settings WHERE shot_id = ?",
            [shot_id],
        )
        grind = await grind_row.fetchone()

        return {
            **dict(shot),
            "timeseries": timeseries,
            "grind": dict(grind) if grind else None,
        }
    finally:
        await db.close()


@router.post("/{shot_id}/feedback")
async def save_feedback(shot_id: int, body: ShotFeedback):
    """フィードバック保存 + LLM改善提案生成."""
    db = await get_db()
    try:
        # ショット存在確認
        row = await db.execute("SELECT id FROM shots WHERE id = ?", [shot_id])
        if not await row.fetchone():
            raise HTTPException(404, "Shot not found")

        # 豆の処理（新規作成 or 既存参照）
        bean_id = body.bean_id
        if not bean_id and body.bean_name:
            existing = await db.execute("SELECT id FROM beans WHERE name = ?", [body.bean_name])
            found = await existing.fetchone()
            if found:
                bean_id = found["id"]
            else:
                cursor = await db.execute("INSERT INTO beans (name) VALUES (?)", [body.bean_name])
                bean_id = cursor.lastrowid

        # ショット更新
        await db.execute(
            """UPDATE shots SET bean_id = ?, dose_g = ?, yield_g = ?,
               yield_ratio = ?, score = ?, feedback = ? WHERE id = ?""",
            [bean_id, body.dose_g, body.yield_g,
             round(body.yield_g / body.dose_g, 2) if body.yield_g and body.dose_g else None,
             body.score, body.feedback, shot_id],
        )

        # グラインド情報保存
        if body.clicks is not None:
            await db.execute(
                """INSERT INTO grind_settings (shot_id, clicks, dose_g, yield_g)
                   VALUES (?, ?, ?, ?)
                   ON CONFLICT(shot_id) DO UPDATE SET clicks=?, dose_g=?, yield_g=?""",
                [shot_id, body.clicks, body.dose_g, body.yield_g,
                 body.clicks, body.dose_g, body.yield_g],
            )

        await db.commit()

        # 時系列データ取得 → 数値分析 → LLM提案
        ts_rows = await db.execute(
            "SELECT t, pressure, temp, weight, flow FROM shot_timeseries WHERE shot_id = ? ORDER BY t",
            [shot_id],
        )
        timeseries = [dict(r) for r in await ts_rows.fetchall()]
        analysis = analyze_shot(timeseries, dose_g=body.dose_g, yield_g=body.yield_g)

        # 同じ豆の過去ショットサマリー
        past_summary = None
        if bean_id:
            past_rows = await db.execute(
                """SELECT duration, yield_ratio, score, feedback
                   FROM shots WHERE bean_id = ? AND id != ? ORDER BY timestamp DESC LIMIT 5""",
                [bean_id, shot_id],
            )
            past = [dict(r) for r in await past_rows.fetchall()]
            if past:
                past_summary = "\n".join(
                    f"- {p['duration']}秒 / {p['yield_ratio']}x / ★{p['score']} / {p['feedback']}"
                    for p in past if p["duration"]
                )

        suggestion = await get_improvement_suggestion(
            analysis=analysis,
            feedback=body.feedback,
            grind_clicks=body.clicks,
            bean_info=body.bean_name,
            past_shots_summary=past_summary,
        )

        # LLM提案を保存
        await db.execute(
            "INSERT INTO llm_suggestions (shot_id, prompt, response, model) VALUES (?, ?, ?, ?)",
            [shot_id, body.feedback, suggestion, "local-model"],
        )
        await db.commit()

        return {
            "shot_id": shot_id,
            "analysis": {
                "duration": analysis.duration,
                "yield_ratio": analysis.yield_ratio,
                "avg_pressure": analysis.avg_pressure,
                "peak_pressure": analysis.peak_pressure,
                "flags": analysis.flags,
            },
            "suggestion": suggestion,
        }
    finally:
        await db.close()


@router.get("/{shot_id}/timeseries")
async def get_timeseries(shot_id: int):
    """時系列データ取得（グラフ表示用）."""
    db = await get_db()
    try:
        rows = await db.execute(
            "SELECT t, pressure, temp, weight, flow FROM shot_timeseries WHERE shot_id = ? ORDER BY t",
            [shot_id],
        )
        return [dict(r) for r in await rows.fetchall()]
    finally:
        await db.close()
