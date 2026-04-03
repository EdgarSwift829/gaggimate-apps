"""GaggiMate WebSocket client for real-time data and commands."""

import asyncio
import json
import logging
from typing import Optional, Callable

import websockets

from ..config import settings
from ..models import MachineState, TimeseriesPoint

logger = logging.getLogger(__name__)


class GaggiMateClient:
    """Manages WebSocket connection to GaggiMate Pro."""

    def __init__(self):
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self.state = MachineState()
        self.is_brewing = False
        self.shot_buffer: list[TimeseriesPoint] = []
        self._listeners: list[Callable] = []
        self._task: Optional[asyncio.Task] = None

    def add_listener(self, callback: Callable):
        self._listeners.append(callback)

    async def connect(self):
        """Connect to GaggiMate WebSocket and start listening."""
        self._task = asyncio.create_task(self._listen_loop())

    async def disconnect(self):
        if self._task:
            self._task.cancel()
        if self.ws:
            await self.ws.close()

    async def _listen_loop(self):
        while True:
            try:
                async with websockets.connect(settings.GAGGIMATE_WS_URL) as ws:
                    self.ws = ws
                    self.state.status = "idle"
                    logger.info("Connected to GaggiMate at %s", settings.GAGGIMATE_WS_URL)
                    async for message in ws:
                        await self._handle_message(message)
            except (websockets.ConnectionClosed, OSError) as e:
                self.state.status = "disconnected"
                logger.warning("GaggiMate connection lost: %s. Reconnecting in 5s...", e)
                await asyncio.sleep(5)

    async def _handle_message(self, raw: str):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return

        msg_type = data.get("type", "")

        if msg_type == "sensor" or "temperature" in data:
            self.state.temperature = data.get("temperature", self.state.temperature)
            self.state.pressure = data.get("pressure", self.state.pressure)
            self.state.weight = data.get("weight", self.state.weight)
            self.state.flow = data.get("flow", self.state.flow)

            if self.is_brewing:
                point = TimeseriesPoint(
                    t=data.get("t", len(self.shot_buffer)),
                    pressure=data.get("pressure"),
                    temp=data.get("temperature"),
                    weight=data.get("weight"),
                    flow=data.get("flow"),
                )
                self.shot_buffer.append(point)

        elif msg_type == "status":
            status = data.get("status", "")
            self.state.status = status
            if status == "brewing" and not self.is_brewing:
                self.is_brewing = True
                self.shot_buffer = []
            elif status != "brewing" and self.is_brewing:
                self.is_brewing = False

        for listener in self._listeners:
            try:
                await listener(data)
            except Exception as e:
                logger.error("Listener error: %s", e)

    async def send_recipe(self, recipe_json: str):
        """Send a recipe JSON to GaggiMate."""
        if self.ws:
            await self.ws.send(json.dumps({
                "type": "recipe",
                "data": json.loads(recipe_json),
            }))

    async def send_command(self, action: str):
        """Send a brew command (start/stop)."""
        if self.ws:
            await self.ws.send(json.dumps({
                "type": "command",
                "action": action,
            }))

    def take_shot_buffer(self) -> list[TimeseriesPoint]:
        """Take and clear the current shot buffer."""
        buffer = self.shot_buffer[:]
        self.shot_buffer = []
        return buffer


# Singleton instance
gaggimate_client = GaggiMateClient()
