"""Bean CRUD API."""

from fastapi import APIRouter, Depends, HTTPException
import aiosqlite

from ..database import get_db
from ..models import BeanCreate, BeanOut

router = APIRouter(prefix="/beans", tags=["beans"])


@router.get("", response_model=list[BeanOut])
async def list_beans(
    q: str | None = None,
    db: aiosqlite.Connection = Depends(get_db),
):
    if q:
        cursor = await db.execute(
            "SELECT * FROM beans WHERE name LIKE ? OR roaster LIKE ? ORDER BY created_at DESC",
            [f"%{q}%", f"%{q}%"],
        )
    else:
        cursor = await db.execute("SELECT * FROM beans ORDER BY created_at DESC")
    return [dict(r) for r in await cursor.fetchall()]


@router.get("/{bean_id}", response_model=BeanOut)
async def get_bean(bean_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT * FROM beans WHERE id = ?", [bean_id])
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(404, "Bean not found")
    return dict(row)


@router.post("", response_model=BeanOut)
async def create_bean(bean: BeanCreate, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "INSERT INTO beans (name, roaster, roast_date, origin, notes) VALUES (?, ?, ?, ?, ?)",
        [bean.name, bean.roaster, bean.roast_date, bean.origin, bean.notes],
    )
    await db.commit()
    cursor = await db.execute("SELECT * FROM beans WHERE id = ?", [cursor.lastrowid])
    return dict(await cursor.fetchone())


@router.put("/{bean_id}", response_model=BeanOut)
async def update_bean(
    bean_id: int, bean: BeanCreate, db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT id FROM beans WHERE id = ?", [bean_id])
    if not await cursor.fetchone():
        raise HTTPException(404, "Bean not found")
    await db.execute(
        "UPDATE beans SET name=?, roaster=?, roast_date=?, origin=?, notes=? WHERE id=?",
        [bean.name, bean.roaster, bean.roast_date, bean.origin, bean.notes, bean_id],
    )
    await db.commit()
    cursor = await db.execute("SELECT * FROM beans WHERE id = ?", [bean_id])
    return dict(await cursor.fetchone())


@router.delete("/{bean_id}")
async def delete_bean(bean_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("DELETE FROM beans WHERE id = ?", [bean_id])
    if cursor.rowcount == 0:
        raise HTTPException(404, "Bean not found")
    await db.commit()
    return {"ok": True}
