"""分析・ダッシュボード REST API."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.database import get_db

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/dashboard")
async def dashboard():
    """長期分析ダッシュボードサマリー."""
    db = await get_db()
    try:
        # Total shot count
        row = await db.execute("SELECT COUNT(*) as total FROM shots")
        total_shots = (await row.fetchone())["total"]

        # Average score
        row = await db.execute("SELECT AVG(score) as avg_score FROM shots WHERE score IS NOT NULL")
        avg_score = (await row.fetchone())["avg_score"]

        # Favorite bean (most used)
        row = await db.execute(
            """SELECT b.name, COUNT(*) as cnt
               FROM shots s
               JOIN beans b ON s.bean_id = b.id
               GROUP BY s.bean_id
               ORDER BY cnt DESC
               LIMIT 1""",
        )
        fav_bean_row = await row.fetchone()
        favorite_bean = dict(fav_bean_row) if fav_bean_row else None

        # Most used recipe
        row = await db.execute(
            """SELECT r.name, COUNT(*) as cnt
               FROM shots s
               JOIN recipes r ON s.recipe_id = r.id
               GROUP BY s.recipe_id
               ORDER BY cnt DESC
               LIMIT 1""",
        )
        top_recipe_row = await row.fetchone()
        most_used_recipe = dict(top_recipe_row) if top_recipe_row else None

        # Score trend: last 30 shots, average per week
        rows = await db.execute(
            """SELECT strftime('%Y-%W', timestamp) as week,
                      AVG(score) as avg_score,
                      COUNT(*) as shot_count
               FROM shots
               WHERE score IS NOT NULL
               ORDER BY timestamp DESC
               LIMIT 30""",
        )
        trend_raw = [dict(r) for r in await rows.fetchall()]

        # Re-aggregate by week from the raw rows
        week_map: dict[str, dict] = {}
        for r in trend_raw:
            week = r["week"]
            if week not in week_map:
                week_map[week] = {"week": week, "avg_score": r["avg_score"], "shot_count": r["shot_count"]}
        score_trend = sorted(week_map.values(), key=lambda x: x["week"])

        return {
            "total_shots": total_shots,
            "avg_score": round(avg_score, 2) if avg_score else None,
            "favorite_bean": favorite_bean,
            "most_used_recipe": most_used_recipe,
            "score_trend": score_trend,
        }
    finally:
        await db.close()


@router.get("/compare")
async def compare_shots(shot_ids: str = Query(..., description="Comma-separated shot IDs")):
    """圧力カーブ比較: 複数ショットの時系列データを返す."""
    try:
        ids = [int(x.strip()) for x in shot_ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(400, "shot_ids must be comma-separated integers")

    if not ids:
        raise HTTPException(400, "At least one shot_id is required")

    db = await get_db()
    try:
        result: dict[str, dict] = {}
        placeholders = ",".join("?" for _ in ids)

        # Fetch shot metadata in one query
        rows = await db.execute(
            f"""SELECT s.id, s.timestamp, s.duration, s.score, s.dose_g, s.yield_g,
                       s.yield_ratio, b.name as bean_name, r.name as recipe_name
                FROM shots s
                LEFT JOIN beans b ON s.bean_id = b.id
                LEFT JOIN recipes r ON s.recipe_id = r.id
                WHERE s.id IN ({placeholders})""",
            ids,
        )
        shots = {row["id"]: dict(row) for row in await rows.fetchall()}

        # Verify all requested shots exist
        missing = [sid for sid in ids if sid not in shots]
        if missing:
            raise HTTPException(404, f"Shots not found: {missing}")

        # Fetch timeseries for all shots in one query
        ts_rows = await db.execute(
            f"""SELECT shot_id, t, pressure, temp, weight, flow
                FROM shot_timeseries
                WHERE shot_id IN ({placeholders})
                ORDER BY shot_id, t""",
            ids,
        )
        all_ts = [dict(r) for r in await ts_rows.fetchall()]

        # Group timeseries by shot_id
        ts_by_shot: dict[int, list[dict]] = {sid: [] for sid in ids}
        for row in all_ts:
            sid = row.pop("shot_id")
            ts_by_shot[sid].append(row)

        # Build result keyed by shot ID
        for sid in ids:
            meta = shots[sid]
            result[str(sid)] = {
                "metadata": {
                    "id": meta["id"],
                    "timestamp": meta["timestamp"],
                    "duration": meta["duration"],
                    "score": meta["score"],
                    "dose_g": meta["dose_g"],
                    "yield_g": meta["yield_g"],
                    "yield_ratio": meta["yield_ratio"],
                    "bean_name": meta["bean_name"],
                    "recipe_name": meta["recipe_name"],
                },
                "timeseries": ts_by_shot.get(sid, []),
            }

        return result
    finally:
        await db.close()


@router.get("/trends")
async def performance_trends(group_by: str = Query("bean", description="Group by 'bean' or 'recipe'")):
    """パフォーマンストレンド: 豆/レシピごとの集約統計."""
    if group_by not in ("bean", "recipe"):
        raise HTTPException(400, "group_by must be 'bean' or 'recipe'")

    db = await get_db()
    try:
        if group_by == "bean":
            rows = await db.execute(
                """SELECT b.id, b.name,
                          AVG(s.score) as avg_score,
                          AVG(s.duration) as avg_duration,
                          AVG(s.yield_ratio) as avg_yield_ratio,
                          COUNT(*) as shot_count
                   FROM shots s
                   JOIN beans b ON s.bean_id = b.id
                   GROUP BY b.id
                   ORDER BY shot_count DESC""",
            )
        else:
            rows = await db.execute(
                """SELECT r.id, r.name,
                          AVG(s.score) as avg_score,
                          AVG(s.duration) as avg_duration,
                          AVG(s.yield_ratio) as avg_yield_ratio,
                          COUNT(*) as shot_count
                   FROM shots s
                   JOIN recipes r ON s.recipe_id = r.id
                   GROUP BY r.id
                   ORDER BY shot_count DESC""",
            )

        results = []
        for r in await rows.fetchall():
            entry = dict(r)
            # Round float aggregates for readability
            if entry["avg_score"] is not None:
                entry["avg_score"] = round(entry["avg_score"], 2)
            if entry["avg_duration"] is not None:
                entry["avg_duration"] = round(entry["avg_duration"], 2)
            if entry["avg_yield_ratio"] is not None:
                entry["avg_yield_ratio"] = round(entry["avg_yield_ratio"], 2)
            results.append(entry)

        return {"group_by": group_by, "data": results}
    finally:
        await db.close()
