"""GaggiMate MQTT 購読クライアント."""
from __future__ import annotations

import asyncio
import logging
from typing import Callable, Awaitable

logger = logging.getLogger("mqtt_client")

# GaggiMate の標準MQTTトピック（v1.6.0+）
TOPICS = [
    "gaggimate/status",
    "gaggimate/shot/start",
    "gaggimate/shot/end",
    "gaggimate/timeseries",
]


class GaggiMateMQTTClient:
    def __init__(self):
        self._listeners: list[Callable[[dict], Awaitable[None]]] = []
        self._task: asyncio.Task | None = None
        self.connected = False

    def add_listener(self, fn: Callable[[dict], Awaitable[None]]) -> None:
        self._listeners.append(fn)

    async def _notify(self, data: dict) -> None:
        for fn in self._listeners:
            try:
                await fn(data)
            except Exception as e:
                logger.error("listener error: %s", e)

    async def connect(self) -> None:
        """MQTT有効時のみ購読ループを開始する."""
        from app.config import settings
        if not settings.mqtt_enabled:
            logger.info("MQTT無効 (MQTT_ENABLED=false) — スキップ")
            return

        try:
            import aiomqtt
        except ImportError:
            logger.warning("aiomqtt が未インストール — MQTT無効")
            return

        logger.info("MQTT接続中 %s:%d", settings.mqtt_broker, settings.mqtt_port)
        while True:
            try:
                async with aiomqtt.Client(settings.mqtt_broker, settings.mqtt_port) as client:
                    self.connected = True
                    logger.info("MQTT接続成功")
                    for topic in TOPICS:
                        await client.subscribe(topic)
                    async for message in client.messages:
                        await self._handle(str(message.topic), message.payload)
            except Exception as e:
                self.connected = False
                logger.error("MQTT切断: %s — 5秒後に再接続", e)
                await asyncio.sleep(5)

    async def _handle(self, topic: str, payload: bytes) -> None:
        import json
        try:
            data = json.loads(payload)
        except Exception:
            data = {"raw": payload.decode(errors="replace")}
        data["_mqtt_topic"] = topic
        await self._notify(data)

    async def disconnect(self) -> None:
        self.connected = False
        if self._task:
            self._task.cancel()


mqtt_client = GaggiMateMQTTClient()
