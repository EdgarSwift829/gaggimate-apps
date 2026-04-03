"""Recipe CRUD API with favorites and sorting."""

from fastapi import APIRouter, Depends, HTTPException, Query
import aiosqlite
from enum import Enum

from ..database import get_db
from ..models import RecipeCreate, RecipeUpdate, RecipeOut

router = APIRouter(prefix="/recipes", tags=["recipes"])


class SortBy(str, Enum):
    score = "avg_score"
    use_count = "use_count"
    created_at = "created_at"
    name = "name"


@router.get("", response_model=list[RecipeOut])
async def list_recipes(
    favorites_only: bool = False,
    sort_by: SortBy = SortBy.created_at,
    sort_desc: bool = True,
    bean_id: int | None = None,
    db: aiosqlite.Connection = Depends(get_db),
):
    """List recipes with sorting and filtering."""
    query = "SELECT DISTINCT r.* FROM recipes r"
    params: list = []

    if bean_id is not None:
        query += " JOIN shots s ON s.recipe_id = r.id AND s.bean_id = ?"
        params.append(bean_id)

    conditions = []
    if favorites_only:
        conditions.append("r.is_favorite = 1")
    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    direction = "DESC" if sort_desc else "ASC"
    # Handle NULL avg_score: put NULLs last
    if sort_by == SortBy.score:
        query += f" ORDER BY r.avg_score IS NULL, r.avg_score {direction}"
    else:
        query += f" ORDER BY r.{sort_by.value} {direction}"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


@router.get("/{recipe_id}", response_model=RecipeOut)
async def get_recipe(recipe_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT * FROM recipes WHERE id = ?", [recipe_id])
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(404, "Recipe not found")
    return dict(row)


@router.post("", response_model=RecipeOut)
async def create_recipe(recipe: RecipeCreate, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "INSERT INTO recipes (name, json, version) VALUES (?, ?, ?)",
        [recipe.name, recipe.json, recipe.version],
    )
    await db.commit()
    cursor = await db.execute("SELECT * FROM recipes WHERE id = ?", [cursor.lastrowid])
    return dict(await cursor.fetchone())


@router.put("/{recipe_id}", response_model=RecipeOut)
async def update_recipe(
    recipe_id: int, update: RecipeUpdate, db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT * FROM recipes WHERE id = ?", [recipe_id])
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(404, "Recipe not found")

    updates = []
    params = []

    if update.name is not None:
        updates.append("name = ?")
        params.append(update.name)
    if update.json is not None:
        updates.append("json = ?")
        params.append(update.json)
        updates.append("version = version + 1")
    if update.is_favorite is not None:
        updates.append("is_favorite = ?")
        params.append(1 if update.is_favorite else 0)

    if updates:
        params.append(recipe_id)
        await db.execute(
            f"UPDATE recipes SET {', '.join(updates)} WHERE id = ?", params
        )
        await db.commit()

    cursor = await db.execute("SELECT * FROM recipes WHERE id = ?", [recipe_id])
    return dict(await cursor.fetchone())


@router.post("/{recipe_id}/favorite", response_model=RecipeOut)
async def toggle_favorite(recipe_id: int, db: aiosqlite.Connection = Depends(get_db)):
    """Toggle the favorite status of a recipe."""
    cursor = await db.execute("SELECT * FROM recipes WHERE id = ?", [recipe_id])
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(404, "Recipe not found")
    new_val = 0 if dict(row)["is_favorite"] else 1
    await db.execute("UPDATE recipes SET is_favorite = ? WHERE id = ?", [new_val, recipe_id])
    await db.commit()
    cursor = await db.execute("SELECT * FROM recipes WHERE id = ?", [recipe_id])
    return dict(await cursor.fetchone())


@router.delete("/{recipe_id}")
async def delete_recipe(recipe_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("DELETE FROM recipes WHERE id = ?", [recipe_id])
    if cursor.rowcount == 0:
        raise HTTPException(404, "Recipe not found")
    await db.commit()
    return {"ok": True}
