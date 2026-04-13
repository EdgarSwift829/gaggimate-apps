"""LINE Notify 通知サービス."""
from __future__ import annotations

import logging
import httpx

logger = logging.getLogger("line_notify")

LINE_NOTIFY_URL = "https://notify-api.line.me/api/notify"


async def send_line_notify(token: str, message: str) -> bool:
    """LINE Notify API でメッセージを送信する."""
    if not token:
        return False
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                LINE_NOTIFY_URL,
                headers={"Authorization": f"Bearer {token}"},
                data={"message": message},
                timeout=10.0,
            )
            if resp.status_code == 200:
                logger.info("LINE Notify 送信成功")
                return True
            logger.warning("LINE Notify 失敗: %s %s", resp.status_code, resp.text)
            return False
    except Exception as e:
        logger.error("LINE Notify エラー: %s", e)
        return False
