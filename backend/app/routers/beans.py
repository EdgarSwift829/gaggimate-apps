"""豆マスター REST API."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import get_db

router = APIRouter(prefix="/api/beans", tags=["beans"])


class BeanCreate(BaseModel):
    name: str
    roaster: str | None = None
    roast_date: str | None = None
    origin: str | None = None
    notes: str | None = None


@router.get("")
async def list_beans():
    db = await get_db()
    try:
        rows = await db.execute("SELECT * FROM beans ORDER BY created_at DESC")
        return [dict(r) for r in await rows.fetchall()]
    finally:
        await db.close()


@router.post("")
async def create_bean(body: BeanCreate):
    db = await get_db()
    try:
        cursor = await db.execute(
            "INSERT INTO beans (name, roaster, roast_date, origin, notes) VALUES (?, ?, ?, ?, ?)",
            [body.name, body.roaster, body.roast_date, body.origin, body.notes],
        )
        await db.commit()
        return {"id": cursor.lastrowid, **body.model_dump()}
    finally:
        await db.close()


@router.put("/{bean_id}")
async def update_bean(bean_id: int, body: BeanCreate):
    db = await get_db()
    try:
        row = await db.execute("SELECT id FROM beans WHERE id = ?", [bean_id])
        if not await row.fetchone():
            raise HTTPException(404, "Bean not found")
        await db.execute(
            "UPDATE beans SET name=?, roaster=?, roast_date=?, origin=?, notes=? WHERE id=?",
            [body.name, body.roaster, body.roast_date, body.origin, body.notes, bean_id],
        )
        await db.commit()
        return {"id": bean_id, **body.model_dump()}
    finally:
        await db.close()


@router.delete("/{bean_id}")
async def delete_bean(bean_id: int):
    db = await get_db()
    try:
        await db.execute("DELETE FROM beans WHERE id = ?", [bean_id])
        await db.commit()
        return {"ok": True}
    finally:
        await db.close()
