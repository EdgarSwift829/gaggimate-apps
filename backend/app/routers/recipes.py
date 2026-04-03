"""レシピ REST API."""

from __future__ import annotations

import json as json_lib
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.database import get_db
from app.services.llm import generate_recipe_suggestion

router = APIRouter(prefix="/api/recipes", tags=["recipes"])


class RecipeCreate(BaseModel):
    name: str
    profile_json: str  # GaggiMateプロファイルJSON文字列
    version: int = 1
    is_favorite: bool = False


class RecipeCustomizeRequest(BaseModel):
    request: str  # ユーザーの要望テキスト
    base_recipe_id: int | None = None


@router.get("")
async def list_recipes(
    sort: str = Query("created_at", pattern="^(created_at|avg_score|use_count)$"),
    favorites_only: bool = False,
    bean_id: int | None = None,
):
    """レシピ一覧（ソート・フィルター対応）."""
    db = await get_db()
    try:
        query = "SELECT * FROM recipes"
        params: list = []
        conditions = []

        if favorites_only:
            conditions.append("is_favorite = 1")
        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        order = {"created_at": "created_at DESC", "avg_score": "avg_score DESC NULLS LAST", "use_count": "use_count DESC"}
        query += f" ORDER BY {order.get(sort, 'created_at DESC')}"

        rows = await db.execute(query, params)
        results = [dict(r) for r in await rows.fetchall()]

        # 豆別フィルター: どのレシピがこの豆で使われたか
        if bean_id is not None:
            used_rows = await db.execute(
                "SELECT DISTINCT recipe_id FROM shots WHERE bean_id = ?", [bean_id]
            )
            used_ids = {r["recipe_id"] for r in await used_rows.fetchall()}
            results = [r for r in results if r["id"] in used_ids]

        return results
    finally:
        await db.close()


@router.post("")
async def create_recipe(body: RecipeCreate):
    db = await get_db()
    try:
        cursor = await db.execute(
            "INSERT INTO recipes (name, json, version, is_favorite) VALUES (?, ?, ?, ?)",
            [body.name, body.profile_json, body.version, int(body.is_favorite)],
        )
        await db.commit()
        return {"id": cursor.lastrowid, **body.model_dump()}
    finally:
        await db.close()


@router.patch("/{recipe_id}/favorite")
async def toggle_favorite(recipe_id: int):
    """お気に入りトグル."""
    db = await get_db()
    try:
        row = await db.execute("SELECT is_favorite FROM recipes WHERE id = ?", [recipe_id])
        recipe = await row.fetchone()
        if not recipe:
            raise HTTPException(404, "Recipe not found")
        new_val = 0 if recipe["is_favorite"] else 1
        await db.execute("UPDATE recipes SET is_favorite = ? WHERE id = ?", [new_val, recipe_id])
        await db.commit()
        return {"id": recipe_id, "is_favorite": bool(new_val)}
    finally:
        await db.close()


@router.post("/customize")
async def customize_recipe(body: RecipeCustomizeRequest):
    """LLMによるレシピカスタマイズ提案."""
    db = await get_db()
    try:
        base_recipe = None
        if body.base_recipe_id:
            row = await db.execute("SELECT json FROM recipes WHERE id = ?", [body.base_recipe_id])
            r = await row.fetchone()
            if r:
                base_recipe = json_lib.loads(r["json"])

        # 過去ショット取得
        past_rows = await db.execute(
            "SELECT duration, yield_ratio, score, feedback FROM shots ORDER BY timestamp DESC LIMIT 5"
        )
        past_shots = [dict(r) for r in await past_rows.fetchall()]

        suggestion = await generate_recipe_suggestion(
            request=body.request,
            past_shots=past_shots,
            base_recipe=base_recipe,
        )
        return {"suggestion": suggestion}
    finally:
        await db.close()
