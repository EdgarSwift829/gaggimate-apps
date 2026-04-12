"""Web Push通知 REST API."""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import get_db
from app.services.notification import get_vapid_public_key

logger = logging.getLogger("notifications")
router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class PushSubscription(BaseModel):
    endpoint: str
    keys: dict  # {p256dh, auth}


@router.get("/vapid-key")
async def vapid_key():
    """VAPID公開鍵を取得（フロントエンドの購読登録に必要）."""
    key = get_vapid_public_key()
    if not key:
        return {"available": False, "message": "pywebpush未インストール — pip install pywebpush"}
    return {"available": True, "public_key": key}


@router.post("/subscribe")
async def subscribe(body: PushSubscription):
    """Push通知購読を登録."""
    db = await get_db()
    try:
        sub_json = json.dumps({"endpoint": body.endpoint, "keys": body.keys})
        # 既存チェック（同じendpoint）
        existing = await db.execute(
            "SELECT id FROM push_subscriptions WHERE endpoint = ?", [body.endpoint]
        )
        if await existing.fetchone():
            await db.execute(
                "UPDATE push_subscriptions SET subscription_json = ? WHERE endpoint = ?",
                [sub_json, body.endpoint],
            )
        else:
            await db.execute(
                "INSERT INTO push_subscriptions (endpoint, subscription_json) VALUES (?, ?)",
                [body.endpoint, sub_json],
            )
        await db.commit()
        return {"ok": True}
    finally:
        await db.close()


@router.post("/unsubscribe")
async def unsubscribe(body: PushSubscription):
    """Push通知購読を解除."""
    db = await get_db()
    try:
        await db.execute("DELETE FROM push_subscriptions WHERE endpoint = ?", [body.endpoint])
        await db.commit()
        return {"ok": True}
    finally:
        await db.close()


class LineTokenRequest(BaseModel):
    token: str
    message: str = "LINE Notify テスト送信"


@router.post("/line-test")
async def line_notify_test(body: LineTokenRequest):
    """LINE Notify 接続テスト."""
    from app.services.line_notify import send_line_notify
    ok = await send_line_notify(body.token, body.message)
    return {"success": ok}
