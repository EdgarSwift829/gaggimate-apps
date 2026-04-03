"""Shot log CRUD and feedback API."""

from fastapi import APIRouter, Depends, HTTPException
import aiosqlite

from ..database import get_db
from ..models import (
    ShotCreate, ShotFeedback, ShotOut, ShotDetail,
    TimeseriesPoint, GrindSettingsOut,
)

router = APIRouter(prefix="/shots", tags=["shots"])


@router.get("", response_model=list[ShotOut])
async def list_shots(
    bean_id: int | None = None,
    recipe_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
    db: aiosqlite.Connection = Depends(get_db),
):
    """List shots with optional filters."""
    query = "SELECT * FROM shots WHERE 1=1"
    params: list = []
    if bean_id is not None:
        query += " AND bean_id = ?"
        params.append(bean_id)
    if recipe_id is not None:
        query += " AND recipe_id = ?"
        params.append(recipe_id)
    query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


@router.get("/{shot_id}", response_model=ShotDetail)
async def get_shot(shot_id: int, db: aiosqlite.Connection = Depends(get_db)):
    """Get shot with timeseries and grind settings."""
    cursor = await db.execute("SELECT * FROM shots WHERE id = ?", [shot_id])
    shot = await cursor.fetchone()
    if not shot:
        raise HTTPException(404, "Shot not found")

    result = dict(shot)

    # Timeseries
    cursor = await db.execute(
        "SELECT t, pressure, temp, weight, flow FROM shot_timeseries WHERE shot_id = ? ORDER BY t",
        [shot_id],
    )
    result["timeseries"] = [dict(r) for r in await cursor.fetchall()]

    # Grind settings
    cursor = await db.execute(
        "SELECT * FROM grind_settings WHERE shot_id = ?", [shot_id]
    )
    grind = await cursor.fetchone()
    result["grind"] = dict(grind) if grind else None

    return result


@router.post("", response_model=ShotOut)
async def create_shot(shot: ShotCreate, db: aiosqlite.Connection = Depends(get_db)):
    """Create a new shot log entry."""
    cursor = await db.execute(
        """INSERT INTO shots (duration, recipe_id, bean_id, score, feedback, yield_g)
           VALUES (?, ?, ?, ?, ?, ?)""",
        [shot.duration, shot.recipe_id, shot.bean_id, shot.score, shot.feedback, shot.yield_g],
    )
    shot_id = cursor.lastrowid

    # Insert timeseries
    if shot.timeseries:
        await db.executemany(
            "INSERT INTO shot_timeseries (shot_id, t, pressure, temp, weight, flow) VALUES (?, ?, ?, ?, ?, ?)",
            [(shot_id, p.t, p.pressure, p.temp, p.weight, p.flow) for p in shot.timeseries],
        )

    # Insert grind settings
    if shot.grind:
        await db.execute(
            "INSERT INTO grind_settings (shot_id, clicks, dose_g, yield_g) VALUES (?, ?, ?, ?)",
            [shot_id, shot.grind.clicks, shot.grind.dose_g, shot.grind.yield_g],
        )

    # Update recipe use_count
    if shot.recipe_id:
        await db.execute(
            "UPDATE recipes SET use_count = use_count + 1 WHERE id = ?",
            [shot.recipe_id],
        )

    await db.commit()

    cursor = await db.execute("SELECT * FROM shots WHERE id = ?", [shot_id])
    return dict(await cursor.fetchone())


@router.put("/{shot_id}/feedback", response_model=ShotOut)
async def update_feedback(
    shot_id: int,
    fb: ShotFeedback,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Update shot feedback (bean, score, grind, feedback text)."""
    cursor = await db.execute("SELECT * FROM shots WHERE id = ?", [shot_id])
    if not await cursor.fetchone():
        raise HTTPException(404, "Shot not found")

    updates = []
    params = []
    if fb.bean_id is not None:
        updates.append("bean_id = ?")
        params.append(fb.bean_id)
    if fb.score is not None:
        updates.append("score = ?")
        params.append(fb.score)
    if fb.feedback is not None:
        updates.append("feedback = ?")
        params.append(fb.feedback)

    if updates:
        params.append(shot_id)
        await db.execute(
            f"UPDATE shots SET {', '.join(updates)} WHERE id = ?", params
        )

    if fb.grind:
        await db.execute("DELETE FROM grind_settings WHERE shot_id = ?", [shot_id])
        await db.execute(
            "INSERT INTO grind_settings (shot_id, clicks, dose_g, yield_g) VALUES (?, ?, ?, ?)",
            [shot_id, fb.grind.clicks, fb.grind.dose_g, fb.grind.yield_g],
        )

    # Update recipe avg_score
    await db.execute(
        """UPDATE recipes SET avg_score = (
               SELECT AVG(score) FROM shots WHERE recipe_id = recipes.id AND score IS NOT NULL
           ) WHERE id IN (SELECT recipe_id FROM shots WHERE id = ?)""",
        [shot_id],
    )

    await db.commit()

    cursor = await db.execute("SELECT * FROM shots WHERE id = ?", [shot_id])
    return dict(await cursor.fetchone())


@router.delete("/{shot_id}")
async def delete_shot(shot_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("DELETE FROM shots WHERE id = ?", [shot_id])
    if cursor.rowcount == 0:
        raise HTTPException(404, "Shot not found")
    await db.commit()
    return {"ok": True}
