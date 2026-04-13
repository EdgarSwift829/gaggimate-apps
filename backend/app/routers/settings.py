"""設定管理 REST API."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger("settings")
router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsSchema(BaseModel):
    gaggimate_host: str
    gaggimate_ws_port: int
    lm_studio_base_url: str
    lm_studio_model: str
    line_notify_token: str | None = None


@router.get("", response_model=SettingsSchema)
async def get_settings() -> SettingsSchema:
    """現在の設定値を返す（内部設定は除く）."""
    return SettingsSchema(
        gaggimate_host=settings.gaggimate_host,
        gaggimate_ws_port=settings.gaggimate_ws_port,
        lm_studio_base_url=settings.lm_studio_base_url,
        lm_studio_model=settings.lm_studio_model,
        line_notify_token=settings.line_notify_token,
    )


@router.put("", response_model=SettingsSchema)
async def update_settings(body: SettingsSchema) -> SettingsSchema:
    """設定値を更新して config.json に保存する（再起動不要）."""
    try:
        settings.gaggimate_host = body.gaggimate_host
        settings.gaggimate_ws_port = body.gaggimate_ws_port
        settings.lm_studio_base_url = body.lm_studio_base_url
        settings.lm_studio_model = body.lm_studio_model
        settings.line_notify_token = body.line_notify_token
        settings.save()
    except Exception as exc:
        logger.exception("設定の保存に失敗しました")
        raise HTTPException(status_code=500, detail=f"設定の保存に失敗しました: {exc}") from exc

    return SettingsSchema(
        gaggimate_host=settings.gaggimate_host,
        gaggimate_ws_port=settings.gaggimate_ws_port,
        lm_studio_base_url=settings.lm_studio_base_url,
        lm_studio_model=settings.lm_studio_model,
        line_notify_token=settings.line_notify_token,
    )
