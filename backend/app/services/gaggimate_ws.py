"""GaggiMate WebSocket クライアント — リアルタイムデータ受信 & コマンド送信."""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any, Callable

import websockets

from app.config import settings

logger = logging.getLogger("gaggimate_ws")


class GaggiMateWSClient:
    """GaggiMate ProへのWebSocket接続を管理するクライアント."""

    def __init__(self) -> None:
        self.ws: websockets.WebSocketClientProtocol | None = None
        self._listeners: list[Callable[[dict], Any]] = []
        self._running = False
        self._brew_buffer: list[dict] = []
        self._is_brewing = False
        self._pending: dict[str, asyncio.Future] = {}

    @property
    def url(self) -> str:
        return f"ws://{settings.gaggimate_host}:{settings.gaggimate_ws_port}/ws"

    def add_listener(self, fn: Callable[[dict], Any]) -> None:
        self._listeners.append(fn)

    @property
    def is_brewing(self) -> bool:
        return self._is_brewing

    @property
    def brew_buffer(self) -> list[dict]:
        return list(self._brew_buffer)

    def clear_brew_buffer(self) -> None:
        self._brew_buffer.clear()

    def take_brew_buffer(self) -> list[dict]:
        """バッファを返却してクリアする（Webhook処理用）."""
        buf = list(self._brew_buffer)
        self._brew_buffer.clear()
        return buf

    async def connect(self) -> None:
        """接続して受信ループを開始."""
        self._running = True
        while self._running:
            try:
                logger.info("Connecting to GaggiMate at %s ...", self.url)
                async with websockets.connect(self.url) as ws:
                    self.ws = ws
                    logger.info("Connected to GaggiMate")
                    async for raw in ws:
                        try:
                            data = json.loads(raw)
                            await self._handle_message(data)
                        except json.JSONDecodeError:
                            logger.warning("Invalid JSON received")
            except (ConnectionRefusedError, OSError) as e:
                logger.warning("Connection failed: %s. Retrying in 5s...", e)
                await asyncio.sleep(5)
            except websockets.ConnectionClosed:
                logger.warning("Connection closed. Reconnecting in 3s...")
                await asyncio.sleep(3)

    async def _handle_message(self, data: dict) -> None:
        tp = data.get("tp", "")
        rid = data.get("rid")

        # Request-Response パターン: rid ベースで pending Future を resolve
        if rid and rid in self._pending:
            self._pending[rid].set_result(data)
            del self._pending[rid]

        if tp == "sub:status":
            mode_raw = data.get("mode", 0)
            was_brewing = self._is_brewing
            # 文字列（シミュレーター）と整数（実機: 1=BREW）の両方に対応
            if isinstance(mode_raw, str):
                self._is_brewing = mode_raw == "brew"
            else:
                self._is_brewing = mode_raw == 1

            if self._is_brewing:
                self._brew_buffer.append(data)
            elif was_brewing and not self._is_brewing:
                # 抽出終了の境界
                logger.info("Brew ended. Buffer size: %d", len(self._brew_buffer))

        for fn in self._listeners:
            try:
                result = fn(data)
                if asyncio.iscoroutine(result):
                    await result
            except Exception:
                logger.exception("Listener error")

    async def send_command(self, tp: str, **kwargs) -> str:
        """GaggiMateにコマンドを送信. request idを返す."""
        if not self.ws:
            raise ConnectionError("Not connected to GaggiMate")
        rid = uuid.uuid4().hex[:8]
        msg = {"tp": tp, "rid": rid, **kwargs}
        await self.ws.send(json.dumps(msg))
        logger.info("Sent command: %s (rid=%s)", tp, rid)
        return rid

    async def send_and_wait(self, tp: str, timeout: float = 5.0, **kwargs) -> dict:
        """コマンドを送信して、レスポンスを待機する（タイムアウト5秒）."""
        if not self.ws:
            raise ConnectionError("Not connected to GaggiMate")
        rid = uuid.uuid4().hex[:8]
        msg = {"tp": tp, "rid": rid, **kwargs}

        # Future を登録
        future: asyncio.Future = asyncio.Future()
        self._pending[rid] = future

        try:
            await self.ws.send(json.dumps(msg))
            logger.info("Sent command: %s (rid=%s)", tp, rid)

            # レスポンスを待機
            result = await asyncio.wait_for(future, timeout=timeout)
            return result
        except asyncio.TimeoutError:
            logger.warning("Timeout waiting for response (rid=%s)", rid)
            if rid in self._pending:
                del self._pending[rid]
            raise TimeoutError(f"No response for {tp} (rid={rid})")

    async def start_brew(self) -> str:
        self._brew_buffer.clear()
        return await self.send_command("req:brew:start")

    async def stop_brew(self) -> str:
        return await self.send_command("req:brew:stop")

    async def list_profiles(self) -> list[dict]:
        """プロファイル一覧を取得."""
        response = await self.send_and_wait("req:profiles:list")
        profiles = response.get("profiles", [])
        return profiles

    async def select_profile(self, profile: dict) -> str:
        return await self.send_command("req:profile:select", profile=profile)

    async def disconnect(self) -> None:
        self._running = False
        if self.ws:
            await self.ws.close()


# シングルトンインスタンス
gaggimate_client = GaggiMateWSClient()
