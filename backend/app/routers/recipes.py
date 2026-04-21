"""レシピ REST API."""

from __future__ import annotations

import json as json_lib
from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel

from app.database import get_db
from app.services.llm import generate_recipe_suggestion
from app.services.gaggimate_ws import gaggimate_client

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
    status: str = Query("active"),  # "active" | "archived" | "all"
    community: bool | None = None,  # None=全部, True=コミュニティのみ, False=オリジナルのみ
):
    """レシピ一覧（ソート・フィルター対応）.

    - status=active（デフォルト）: is_archived = 0 のみ返す
    - status=archived: is_archived = 1 のみ返す
    - status=all: 全件返す
    - community=true: is_community = 1 のみ
    - community=false: is_community = 0 のみ
    """
    db = await get_db()
    try:
        query = "SELECT * FROM recipes"
        params: list = []
        conditions = []

        if status == "all":
            pass  # フィルターなし
        elif status == "archived":
            conditions.append("COALESCE(is_archived, 0) = 1")
        else:  # "active" またはデフォルト
            conditions.append("COALESCE(is_archived, 0) = 0")

        if community is True:
            conditions.append("COALESCE(is_community, 0) = 1")
        elif community is False:
            conditions.append("COALESCE(is_community, 0) = 0")

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


@router.patch("/{recipe_id}/archive")
async def toggle_archive(recipe_id: int):
    """アーカイブトグル（0→1, 1→0）."""
    from datetime import datetime, timezone
    db = await get_db()
    try:
        row = await db.execute("SELECT is_archived FROM recipes WHERE id = ?", [recipe_id])
        recipe = await row.fetchone()
        if not recipe:
            raise HTTPException(404, "Recipe not found")
        current = recipe["is_archived"] or 0
        new_val = 0 if current else 1
        archived_at = datetime.now(timezone.utc).isoformat() if new_val else None
        await db.execute(
            "UPDATE recipes SET is_archived = ?, archived_at = ? WHERE id = ?",
            [new_val, archived_at, recipe_id],
        )
        await db.commit()
        return {"id": recipe_id, "is_archived": bool(new_val), "archived_at": archived_at}
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


class RecipeUpdate(BaseModel):
    name: str | None = None
    profile_json: str | None = None
    is_favorite: bool | None = None


@router.put("/{recipe_id}")
async def update_recipe(recipe_id: int, body: RecipeUpdate):
    """レシピ更新（名前・JSON・お気に入り）."""
    db = await get_db()
    try:
        row = await db.execute("SELECT * FROM recipes WHERE id = ?", [recipe_id])
        recipe = await row.fetchone()
        if not recipe:
            raise HTTPException(404, "Recipe not found")
        fields, params = [], []
        if body.name is not None:
            fields.append("name = ?"); params.append(body.name)
        if body.profile_json is not None:
            fields.append("json = ?"); params.append(body.profile_json)
        if body.is_favorite is not None:
            fields.append("is_favorite = ?"); params.append(int(body.is_favorite))
        if not fields:
            return dict(recipe)
        params.append(recipe_id)
        await db.execute(f"UPDATE recipes SET {', '.join(fields)} WHERE id = ?", params)
        await db.commit()
        row = await db.execute("SELECT * FROM recipes WHERE id = ?", [recipe_id])
        return dict(await row.fetchone())
    finally:
        await db.close()


@router.get("/{recipe_id}/usage")
async def get_recipe_usage(recipe_id: int):
    """レシピがショットで使われている件数を返す."""
    db = await get_db()
    try:
        row = await db.execute("SELECT id FROM recipes WHERE id = ?", [recipe_id])
        if not await row.fetchone():
            raise HTTPException(404, "Recipe not found")
        count_row = await db.execute(
            "SELECT COUNT(*) AS cnt FROM shots WHERE recipe_id = ?", [recipe_id]
        )
        result = await count_row.fetchone()
        shot_count = result["cnt"] if result else 0
        return {"recipe_id": recipe_id, "shot_count": shot_count}
    finally:
        await db.close()


@router.delete("/{recipe_id}")
async def delete_recipe(recipe_id: int, force: bool = False):
    """レシピ削除（安全版）.

    - shots 参照なし → ハードデリート
    - shots 参照あり、force=False → HTTP 409
    - shots 参照あり、force=True → is_archived=1 にしてソフト削除
    """
    db = await get_db()
    try:
        row = await db.execute("SELECT id FROM recipes WHERE id = ?", [recipe_id])
        if not await row.fetchone():
            raise HTTPException(404, "Recipe not found")

        # shotsテーブルでの参照件数を確認
        count_row = await db.execute(
            "SELECT COUNT(*) AS cnt FROM shots WHERE recipe_id = ?", [recipe_id]
        )
        result = await count_row.fetchone()
        shot_count = result["cnt"] if result else 0

        if shot_count > 0 and not force:
            raise HTTPException(
                409,
                f"Recipe is used in {shot_count} shots. Use ?force=true to archive instead.",
            )

        if shot_count > 0 and force:
            # is_archivedカラムが存在しない場合は追加する
            try:
                await db.execute(
                    "ALTER TABLE recipes ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0"
                )
                await db.commit()
            except Exception:
                # カラムが既に存在する場合は無視
                pass
            await db.execute(
                "UPDATE recipes SET is_archived = 1 WHERE id = ?", [recipe_id]
            )
            await db.commit()
            return {"ok": True, "archived": True}

        # 参照なし → ハードデリート
        await db.execute("DELETE FROM recipes WHERE id = ?", [recipe_id])
        await db.commit()
        return {"ok": True, "archived": False}
    finally:
        await db.close()


_DEFAULT_RECIPES = [
    {
        "name": "ハンドエスプレッソ風（蒸らし）",
        "extractionTimeSec": 30,
        "targetVolumeMl": 32,
        "curves": {
            "temp":     [{"t": 0, "v": 93}, {"t": 30, "v": 93}],
            "pressure": [{"t": 0, "v": 3}, {"t": 3, "v": 3}, {"t": 8, "v": 9}, {"t": 30, "v": 9}],
            "flow":     [{"t": 0, "v": 1.75}, {"t": 3, "v": 1.75}, {"t": 8, "v": 2.5}, {"t": 30, "v": 2.5}],
        },
    },
    {
        "name": "低圧スロー",
        "extractionTimeSec": 40,
        "targetVolumeMl": 32,
        "curves": {
            "temp":     [{"t": 0, "v": 91}, {"t": 40, "v": 91}],
            "pressure": [{"t": 0, "v": 2}, {"t": 5, "v": 6}, {"t": 40, "v": 6}],
            "flow":     [{"t": 0, "v": 1}, {"t": 5, "v": 1.5}, {"t": 40, "v": 1.5}],
        },
    },
    {
        "name": "ターボショット",
        "extractionTimeSec": 18,
        "targetVolumeMl": 32,
        "curves": {
            "temp":     [{"t": 0, "v": 94}, {"t": 18, "v": 94}],
            "pressure": [{"t": 0, "v": 4}, {"t": 3, "v": 9}, {"t": 18, "v": 9}],
            "flow":     [{"t": 0, "v": 2}, {"t": 3, "v": 3.5}, {"t": 18, "v": 3.5}],
        },
    },
    {
        "name": "ディクリーニング（レバー風）",
        "extractionTimeSec": 33,
        "targetVolumeMl": 32,
        "curves": {
            "temp":     [{"t": 0, "v": 92}, {"t": 33, "v": 92}],
            "pressure": [{"t": 0, "v": 4}, {"t": 8, "v": 4}, {"t": 13, "v": 9}, {"t": 33, "v": 4}],
            "flow":     [{"t": 0, "v": 1.5}, {"t": 8, "v": 1.5}, {"t": 13, "v": 2}, {"t": 33, "v": 1.25}],
        },
    },
    {
        "name": "トロトロ（赤石スタイル）",
        "extractionTimeSec": 35,
        "targetVolumeMl": 23,
        "curves": {
            "temp":     [{"t": 0, "v": 89}, {"t": 35, "v": 89}],
            "pressure": [{"t": 0, "v": 3}, {"t": 5, "v": 3}, {"t": 10, "v": 9}, {"t": 35, "v": 6}],
            "flow":     [{"t": 0, "v": 1}, {"t": 5, "v": 1}, {"t": 10, "v": 1.5}, {"t": 35, "v": 0.9}],
        },
    },
]


async def seed_defaults() -> dict:
    """プリセットレシピを登録（同名が存在する場合はスキップ）."""
    db = await get_db()
    try:
        created = 0
        skipped = 0
        for recipe in _DEFAULT_RECIPES:
            row = await db.execute("SELECT id FROM recipes WHERE name = ?", [recipe["name"]])
            if await row.fetchone():
                skipped += 1
                continue
            await db.execute(
                "INSERT INTO recipes (name, json, version, is_favorite) VALUES (?, ?, ?, ?)",
                [recipe["name"], json_lib.dumps(recipe), 1, 0],
            )
            created += 1
        await db.commit()
        return {"created": created, "skipped": skipped}
    finally:
        await db.close()


@router.post("/seed-defaults")
async def seed_default_recipes():
    return await seed_defaults()


@router.post("/sync-from-device")
async def sync_recipes_from_device():
    """GaggiMate デバイスからプロファイルを同期し、DBに保存."""
    db = await get_db()
    try:
        # デバイスからプロファイル一覧を取得
        profiles = await gaggimate_client.list_profiles()

        synced_count = 0

        for profile in profiles:
            profile_id = profile.get("id")
            profile_name = profile.get("label", profile_id or "Unknown")
            profile_json = json_lib.dumps(profile)

            if not profile_id:
                continue

            # source が一致する既存レシピを確認
            existing_row = await db.execute(
                "SELECT id FROM recipes WHERE source = ?", [profile_id]
            )
            existing = await existing_row.fetchone()

            if existing:
                # 既存レシピを更新
                await db.execute(
                    "UPDATE recipes SET name = ?, json = ? WHERE source = ?",
                    [profile_name, profile_json, profile_id],
                )
                synced_count += 1
            else:
                # 新規レシピを挿入
                await db.execute(
                    "INSERT INTO recipes (name, json, is_community, source, version) VALUES (?, ?, ?, ?, ?)",
                    [profile_name, profile_json, 1, profile_id, 1],
                )
                synced_count += 1

        await db.commit()
        return {"synced": synced_count}
    finally:
        await db.close()
