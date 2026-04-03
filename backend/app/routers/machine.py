"""GaggiMateマシン操作 API（WebSocket経由）."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.gaggimate_ws import gaggimate_client

router = APIRouter(prefix="/api/machine", tags=["machine"])


class ProfilePayload(BaseModel):
    label: str
    type: str = "simple"
    temperature: float = 93.0
    phases: list[dict] = []


@router.get("/status")
async def get_status():
    """現在のマシンステータス."""
    return {
        "connected": gaggimate_client.ws is not None,
        "is_brewing": gaggimate_client.is_brewing,
    }


@router.post("/brew/start")
async def start_brew():
    try:
        rid = await gaggimate_client.start_brew()
        return {"ok": True, "rid": rid}
    except ConnectionError as e:
        raise HTTPException(503, str(e))


@router.post("/brew/stop")
async def stop_brew():
    try:
        rid = await gaggimate_client.stop_brew()
        return {"ok": True, "rid": rid}
    except ConnectionError as e:
        raise HTTPException(503, str(e))


@router.get("/profiles")
async def list_profiles():
    try:
        rid = await gaggimate_client.list_profiles()
        return {"ok": True, "rid": rid}
    except ConnectionError as e:
        raise HTTPException(503, str(e))


@router.post("/profiles/select")
async def select_profile(body: ProfilePayload):
    try:
        rid = await gaggimate_client.select_profile(body.model_dump())
        return {"ok": True, "rid": rid}
    except ConnectionError as e:
        raise HTTPException(503, str(e))
