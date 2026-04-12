"""LLMレシピ生成・チャット・コミュニティインポート API."""

from __future__ import annotations

import json
import logging
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.database import get_db
from app.services.llm import client, generate_recipe_suggestion
from app.services.prompt_manager import get_template

logger = logging.getLogger("recipe_ai")
router = APIRouter(prefix="/api/recipes/ai", tags=["recipe-ai"])


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class GenerateRequest(BaseModel):
    description: str
    bean_id: int | None = None
    target_flavor: str | None = None


class ChatRequest(BaseModel):
    message: str
    history: list[dict[str, str]] = []
    recipe_id: int | None = None


class ImportRequest(BaseModel):
    json_text: str
    name: str | None = None
    source: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_json_block(text: str) -> str | None:
    """Extract JSON from ```json ... ``` fenced blocks in LLM output."""
    match = re.search(r"```json\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return None


def _parse_label(recipe_json: str) -> str | None:
    """Try to extract 'label' field from recipe JSON string."""
    try:
        data = json.loads(recipe_json)
        if isinstance(data, dict):
            return data.get("label")
    except (json.JSONDecodeError, TypeError):
        pass
    return None


# ---------------------------------------------------------------------------
# 1. POST /api/recipes/ai/generate  — LLM recipe auto-generation
# ---------------------------------------------------------------------------

@router.post("/generate")
async def generate_recipe(body: GenerateRequest):
    """LLMを使ってレシピプロファイルJSONを自動生成."""
    db = await get_db()
    try:
        # Gather context: bean info
        bean_info = None
        if body.bean_id:
            row = await db.execute(
                "SELECT name, roaster, origin, notes FROM beans WHERE id = ?",
                [body.bean_id],
            )
            bean = await row.fetchone()
            if bean:
                b = dict(bean)
                bean_info = (
                    f"Bean: {b['name']}"
                    + (f" / Roaster: {b['roaster']}" if b.get("roaster") else "")
                    + (f" / Origin: {b['origin']}" if b.get("origin") else "")
                    + (f" / Notes: {b['notes']}" if b.get("notes") else "")
                )

        # Gather context: recent shots
        past_rows = await db.execute(
            "SELECT duration, yield_ratio, score, feedback FROM shots ORDER BY timestamp DESC LIMIT 5",
        )
        past_shots = [dict(r) for r in await past_rows.fetchall()]

        # Build the user request text
        request_text = body.description
        if body.target_flavor:
            request_text += f"\nTarget flavor: {body.target_flavor}"
        if bean_info:
            request_text += f"\n{bean_info}"

        # Call the existing generate_recipe_suggestion helper
        suggestion = await generate_recipe_suggestion(
            request=request_text,
            past_shots=past_shots if past_shots else None,
        )

        # Extract JSON block from the response
        recipe_json = _extract_json_block(suggestion)
        name = _parse_label(recipe_json) if recipe_json else None

        return {
            "suggestion": suggestion,
            "recipe_json": recipe_json,
            "name": name,
        }
    finally:
        await db.close()


# ---------------------------------------------------------------------------
# 2. POST /api/recipes/ai/chat  — Multi-turn recipe customization dialog
# ---------------------------------------------------------------------------

@router.post("/chat")
async def chat_recipe(body: ChatRequest):
    """LLMとのマルチターン会話でレシピをカスタマイズ."""
    db = await get_db()
    try:
        # Optionally load an existing recipe as context
        recipe_context = ""
        if body.recipe_id:
            row = await db.execute(
                "SELECT name, json FROM recipes WHERE id = ?",
                [body.recipe_id],
            )
            recipe = await row.fetchone()
            if recipe:
                r = dict(recipe)
                recipe_context = (
                    f"\n\nCurrent recipe \"{r['name']}\":\n```json\n{r['json']}\n```"
                )

        # Build messages list
        system_prompt = get_template("recipe_customize_system")
        if recipe_context:
            system_prompt += recipe_context

        messages: list[dict[str, str]] = [
            {"role": "system", "content": system_prompt},
        ]
        # Add conversation history
        for entry in body.history:
            messages.append({"role": entry["role"], "content": entry["content"]})
        # Add the current user message
        messages.append({"role": "user", "content": body.message})

        # LLM call
        try:
            response = await client.chat.completions.create(
                model=settings.lm_studio_model,
                messages=messages,
                temperature=0.7,
                max_tokens=1024,
            )
            reply = response.choices[0].message.content or ""
        except Exception as e:
            logger.error("LLM chat request failed: %s", e)
            reply = f"LLM接続エラー: {e}\nLM Studioが起動していてモデルがロードされているか確認してください。"
            recipe_json = None

        # Extract JSON if present
        recipe_json = _extract_json_block(reply)

        return {
            "reply": reply,
            "recipe_json": recipe_json,
        }
    finally:
        await db.close()


# ---------------------------------------------------------------------------
# 3. POST /api/recipes/import  — Community recipe import
# ---------------------------------------------------------------------------

import_router = APIRouter(prefix="/api/recipes", tags=["recipe-ai"])


@import_router.post("/import")
async def import_recipe(body: ImportRequest):
    """コミュニティレシピJSONをインポート."""
    # Validate JSON
    try:
        parsed = json.loads(body.json_text)
    except json.JSONDecodeError as e:
        raise HTTPException(400, f"Invalid JSON: {e}")

    # Determine recipe name
    name = body.name
    if not name and isinstance(parsed, dict):
        name = parsed.get("label") or parsed.get("name")
    if not name:
        name = "Imported Recipe"

    db = await get_db()
    try:
        cursor = await db.execute(
            """INSERT INTO recipes (name, json, is_community, source)
               VALUES (?, ?, 1, ?)""",
            [name, body.json_text, body.source],
        )
        await db.commit()
        recipe_id = cursor.lastrowid

        # Fetch the created row
        row = await db.execute("SELECT * FROM recipes WHERE id = ?", [recipe_id])
        created = await row.fetchone()
        return dict(created)
    finally:
        await db.close()
