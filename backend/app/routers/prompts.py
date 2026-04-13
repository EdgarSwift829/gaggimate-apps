"""プロンプトテンプレート管理 REST API."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.prompt_manager import list_templates, get_template, update_template

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


class PromptUpdate(BaseModel):
    content: str


@router.get("")
async def list_all():
    """利用可能なテンプレート一覧."""
    return list_templates()


@router.get("/{name}")
async def get_prompt(name: str):
    """テンプレート取得."""
    try:
        content = get_template(name)
        return {"name": name, "content": content}
    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(404, str(e))


@router.put("/{name}")
async def update_prompt(name: str, body: PromptUpdate):
    """テンプレート更新."""
    try:
        update_template(name, body.content)
        return {"name": name, "updated": True}
    except ValueError as e:
        raise HTTPException(400, str(e))
