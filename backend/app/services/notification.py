"""Web Push通知サービス."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from app.config import settings

logger = logging.getLogger("notification")

# VAPID鍵ファイルパス
VAPID_KEY_FILE = Path(settings.db_path).parent / "vapid_keys.json"


def _get_vapid_keys() -> dict | None:
    """VAPID鍵を取得（なければNone）."""
    if VAPID_KEY_FILE.exists():
        with VAPID_KEY_FILE.open() as f:
            return json.load(f)
    return None


def generate_vapid_keys() -> dict:
    """VAPID鍵ペアを生成して保存."""
    try:
        from py_vapid import Vapid

        vapid = Vapid()
        vapid.generate_keys()
        keys = {
            "public_key": vapid.public_key_urlsafe_base64,
            "private_key": vapid.private_key_urlsafe_base64,
        }
        VAPID_KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
        with VAPID_KEY_FILE.open("w") as f:
            json.dump(keys, f)
        logger.info("VAPID keys generated and saved")
        return keys
    except ImportError:
        logger.warning("pywebpush not installed — push notifications disabled")
        return {}


def get_vapid_public_key() -> str | None:
    """公開鍵を取得（鍵がなければ生成）."""
    keys = _get_vapid_keys()
    if not keys:
        keys = generate_vapid_keys()
    return keys.get("public_key")


async def send_push(subscription_info: dict, title: str, body: str, url: str = "/") -> bool:
    """Web Push通知を送信."""
    try:
        from pywebpush import webpush, WebPushException

        keys = _get_vapid_keys()
        if not keys:
            logger.warning("No VAPID keys — cannot send push")
            return False

        payload = json.dumps({
            "title": title,
            "body": body,
            "url": url,
        })

        webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=keys["private_key"],
            vapid_claims={"sub": "mailto:gaggimate@localhost"},
        )
        return True
    except ImportError:
        logger.warning("pywebpush not installed")
        return False
    except Exception as e:
        logger.error("Push notification failed: %s", e)
        return False


async def notify_shot_complete(shot_id: int, duration: float | None):
    """ショット完了通知を全購読者に送信."""
    from app.database import get_db

    db = await get_db()
    try:
        rows = await db.execute("SELECT subscription_json FROM push_subscriptions")
        subs = await rows.fetchall()
        for sub in subs:
            info = json.loads(sub["subscription_json"])
            await send_push(
                info,
                title="抽出完了",
                body=f"ショット #{shot_id} 完了（{duration:.0f}秒）" if duration else f"ショット #{shot_id} 完了",
                url=f"/shot/{shot_id}",
            )
    finally:
        await db.close()


async def notify_suggestion_ready(shot_id: int):
    """LLM提案完了通知を全購読者に送信."""
    from app.database import get_db

    db = await get_db()
    try:
        rows = await db.execute("SELECT subscription_json FROM push_subscriptions")
        subs = await rows.fetchall()
        for sub in subs:
            info = json.loads(sub["subscription_json"])
            await send_push(
                info,
                title="改善提案が完了",
                body=f"ショット #{shot_id} の改善提案が準備できました",
                url=f"/shot/{shot_id}",
            )
    finally:
        await db.close()
