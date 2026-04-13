"""
GaggiMate Pro シミュレーター
=============================
GaggiMate Pro（ESP32）のWebSocket API / Webhook をダミーで再現する。
実機なしでバックエンド・フロントエンドの開発・テストを可能にする。

使い方:
    pip install websockets aiohttp
    python gaggimate_sim.py [--host 0.0.0.0] [--ws-port 8765] [--webhook-url http://localhost:8000/webhook]

WebSocket: ws://localhost:8765/ws
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import math
import random
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

import aiohttp
import websockets
from websockets.server import ServerConnection

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("gaggimate-sim")

# ---------------------------------------------------------------------------
# Machine State
# ---------------------------------------------------------------------------

class MachineMode(str, Enum):
    STANDBY = "standby"
    BREW = "brew"
    STEAM = "steam"
    HOT_WATER = "hot_water"

class BrewPhase(str, Enum):
    IDLE = "idle"
    PREINFUSION = "preinfusion"
    BREW = "brew"
    DECLINE = "decline"

@dataclass
class Profile:
    id: str
    label: str
    type: str  # "simple" | "pro"
    temperature: float
    description: str
    is_favorite: bool
    version: int
    phases: list[dict[str, Any]]

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "label": self.label,
            "type": self.type,
            "temperature": self.temperature,
            "description": self.description,
            "is_favorite": self.is_favorite,
            "version": self.version,
            "phases": self.phases,
        }

# デフォルトプロファイル
DEFAULT_PROFILES = [
    Profile(
        id="profile_default",
        label="Classic Espresso",
        type="simple",
        temperature=93.0,
        description="9bar standard espresso",
        is_favorite=True,
        version=1,
        phases=[
            {
                "name": "Preinfusion",
                "phase": "preinfusion",
                "valve": 1,
                "duration": 5,
                "pump": {"pressure": 2.0, "flow": None},
                "transition": {"type": "ramp", "duration": 1.5},
                "targets": {"pumped": 10},
            },
            {
                "name": "Extraction",
                "phase": "brew",
                "valve": 1,
                "duration": 25,
                "pump": {"pressure": 9.0, "flow": None},
                "transition": {"type": "ramp", "duration": 2},
                "targets": {"pumped": 45},
            },
        ],
    ),
    Profile(
        id="profile_long_pi",
        label="Long Preinfusion",
        type="pro",
        temperature=92.0,
        description="8s preinfusion + declining pressure",
        is_favorite=False,
        version=1,
        phases=[
            {
                "name": "Bloom",
                "phase": "preinfusion",
                "valve": 1,
                "duration": 8,
                "pump": {"pressure": 2.5, "flow": 2.0},
                "transition": {"type": "ramp", "duration": 2},
                "targets": {"pumped": 12},
            },
            {
                "name": "Ramp Up",
                "phase": "brew",
                "valve": 1,
                "duration": 8,
                "pump": {"pressure": 9.0, "flow": None},
                "transition": {"type": "ramp", "duration": 3},
                "targets": {},
            },
            {
                "name": "Main Extraction",
                "phase": "brew",
                "valve": 1,
                "duration": 15,
                "pump": {"pressure": 8.5, "flow": None},
                "transition": {"type": "ramp", "duration": 1},
                "targets": {"pumped": 40},
            },
            {
                "name": "Decline",
                "phase": "decline",
                "valve": 1,
                "duration": 5,
                "pump": {"pressure": 5.0, "flow": None},
                "transition": {"type": "ramp", "duration": 3},
                "targets": {"pumped": 48},
            },
        ],
    ),
]


@dataclass
class MachineState:
    mode: MachineMode = MachineMode.STANDBY
    brew_phase: BrewPhase = BrewPhase.IDLE
    current_temp: float = 25.0
    target_temp: float = 93.0
    pressure: float = 0.0
    flow: float = 0.0
    weight: float = 0.0
    elapsed_time: float = 0.0
    pumping: bool = False
    profiles: list[Profile] = field(default_factory=lambda: list(DEFAULT_PROFILES))
    selected_profile: Profile | None = None

    # 抽出シミュレーション内部状態
    _brew_start: float = 0.0
    _phase_idx: int = 0
    _phase_start: float = 0.0
    _total_pumped: float = 0.0
    _telemetry: list[dict] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Brew Physics Simulation
# ---------------------------------------------------------------------------

def _noise(base: float, pct: float = 0.02) -> float:
    """Add realistic noise to sensor readings."""
    return base + base * random.uniform(-pct, pct)


def simulate_standby_heating(state: MachineState, dt: float = 1.0) -> None:
    """スタンバイ中のボイラー加熱シミュレーション."""
    diff = state.target_temp - state.current_temp
    if abs(diff) > 0.3:
        # PID的な加熱: 差分に比例して近づく
        rate = min(2.0, abs(diff) * 0.15) * dt
        state.current_temp += math.copysign(rate, diff)
    else:
        # 目標付近で微小な揺れ
        state.current_temp = _noise(state.target_temp, 0.003)
    state.pressure = 0.0
    state.flow = 0.0
    state.weight = 0.0
    state.elapsed_time = 0.0


def simulate_brew_tick(state: MachineState) -> bool:
    """
    抽出中の1秒分のシミュレーション.
    Returns True if brew finished.
    """
    profile = state.selected_profile
    if not profile or not profile.phases:
        return True

    now = time.monotonic()
    state.elapsed_time = now - state._brew_start
    phase_elapsed = now - state._phase_start

    phase_def = profile.phases[state._phase_idx]
    phase_duration = phase_def.get("duration", 30)
    pump_cfg = phase_def.get("pump", {})
    target_pressure = pump_cfg.get("pressure", 9.0)
    target_flow = pump_cfg.get("flow") or (2.5 if target_pressure < 4 else 3.2)
    transition = phase_def.get("transition", {})
    ramp_dur = transition.get("duration", 1.0)
    targets = phase_def.get("targets", {})

    # Ramp factor: 0→1 over ramp duration
    ramp_factor = min(1.0, phase_elapsed / max(0.1, ramp_dur))

    # フェーズ名からBrewPhaseを推定
    phase_name = phase_def.get("phase", "brew")
    if phase_name == "preinfusion":
        state.brew_phase = BrewPhase.PREINFUSION
    elif phase_name == "decline":
        state.brew_phase = BrewPhase.DECLINE
    else:
        state.brew_phase = BrewPhase.BREW

    # 圧力・フロー・温度のシミュレーション
    state.pressure = _noise(target_pressure * ramp_factor, 0.03)
    state.flow = _noise(target_flow * ramp_factor, 0.05)
    state.pumping = True
    state.current_temp = _noise(profile.temperature, 0.005)

    # 重量（フロー積算 + ランダム遅延）
    flow_increment = state.flow * 1.0  # 1秒あたり
    state._total_pumped += flow_increment
    state.weight = _noise(state._total_pumped * 0.95, 0.02)  # 少しロスを模擬

    # テレメトリ記録
    state._telemetry.append({
        "t": round(state.elapsed_time, 1),
        "pressure": round(state.pressure, 2),
        "temperature": round(state.current_temp, 2),
        "flow": round(state.flow, 2),
        "weight": round(state.weight, 2),
    })

    # フェーズ終了判定
    phase_done = False
    if phase_elapsed >= phase_duration:
        phase_done = True
    if "pumped" in targets and state._total_pumped >= targets["pumped"]:
        phase_done = True
    if "weight" in targets and state.weight >= targets["weight"]:
        phase_done = True

    if phase_done:
        state._phase_idx += 1
        state._phase_start = now
        if state._phase_idx >= len(profile.phases):
            return True  # 全フェーズ完了

    return False


def build_webhook_payload(state: MachineState) -> dict:
    """ショット完了時のWebhookペイロードを構築."""
    profile = state.selected_profile
    phases_summary = []

    if profile and profile.phases:
        # テレメトリからフェーズごとの集計を簡易計算
        phase_names = [p["name"] for p in profile.phases]
        n_phases = len(phase_names)
        chunk_size = max(1, len(state._telemetry) // n_phases)

        for i, phase_def in enumerate(profile.phases):
            start = i * chunk_size
            end = start + chunk_size if i < n_phases - 1 else len(state._telemetry)
            chunk = state._telemetry[start:end]
            if chunk:
                phases_summary.append({
                    "name": phase_def["name"],
                    "duration": round(chunk[-1]["t"] - chunk[0]["t"], 1),
                    "avg_pressure": round(sum(c["pressure"] for c in chunk) / len(chunk), 2),
                    "avg_temperature": round(sum(c["temperature"] for c in chunk) / len(chunk), 2),
                    "avg_flow": round(sum(c["flow"] for c in chunk) / len(chunk), 2),
                })

    dose = 18.0  # ダミー値（実機ではスケール or ユーザー入力）
    yield_g = round(state.weight, 1)

    return {
        "event": "shot_complete",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "shot_id": time.strftime("%Y%m%d_%H%M%S"),
        "duration": round(state.elapsed_time, 1),
        "yield": yield_g,
        "dose": dose,
        "yield_ratio": round(yield_g / dose, 2) if dose > 0 else 0,
        "water_pumped": round(state._total_pumped, 1),
        "profile_used": {
            "id": profile.id if profile else "unknown",
            "label": profile.label if profile else "Unknown",
            "version": profile.version if profile else 0,
        },
        "phases": phases_summary,
        "telemetry": {
            "pressure_points": [{"t": t["t"], "value": t["pressure"]} for t in state._telemetry],
            "temperature_points": [{"t": t["t"], "value": t["temperature"]} for t in state._telemetry],
            "flow_points": [{"t": t["t"], "value": t["flow"]} for t in state._telemetry],
            "weight_points": [{"t": t["t"], "value": t["weight"]} for t in state._telemetry],
        },
    }


# ---------------------------------------------------------------------------
# WebSocket Server
# ---------------------------------------------------------------------------

class GaggiMateSimServer:
    def __init__(self, host: str, ws_port: int, webhook_url: str | None):
        self.host = host
        self.ws_port = ws_port
        self.webhook_url = webhook_url
        self.state = MachineState()
        self.state.selected_profile = self.state.profiles[0]
        self.clients: set[ServerConnection] = set()
        self._brew_task: asyncio.Task | None = None

    async def broadcast(self, message: dict) -> None:
        data = json.dumps(message)
        dead = set()
        for ws in self.clients:
            try:
                await ws.send(data)
            except websockets.ConnectionClosed:
                dead.add(ws)
        self.clients -= dead

    def _status_msg(self) -> dict:
        return {
            "tp": "sub:status",
            "current_temp": round(self.state.current_temp, 2),
            "target_temp": round(self.state.target_temp, 2),
            "pressure": round(self.state.pressure, 2),
            "flow": round(self.state.flow, 2),
            "mode": self.state.mode.value,
            "weight": round(self.state.weight, 2),
            "phase": self.state.brew_phase.value,
            "elapsed_time": round(self.state.elapsed_time, 1),
            "pumping": self.state.pumping,
            "supports_pressure_control": True,
            "supports_dimming": True,
        }

    # --- Brew lifecycle ---

    async def _start_brew(self) -> None:
        logger.info("=== BREW START === profile: %s", self.state.selected_profile.label if self.state.selected_profile else "None")
        self.state.mode = MachineMode.BREW
        self.state.brew_phase = BrewPhase.PREINFUSION
        self.state._brew_start = time.monotonic()
        self.state._phase_start = time.monotonic()
        self.state._phase_idx = 0
        self.state._total_pumped = 0.0
        self.state._telemetry = []

    async def _finish_brew(self) -> None:
        logger.info("=== BREW COMPLETE === duration: %.1fs, yield: %.1fg", self.state.elapsed_time, self.state.weight)
        self.state.pumping = False
        self.state.pressure = 0.0
        self.state.flow = 0.0

        # Webhook送信
        if self.webhook_url:
            payload = build_webhook_payload(self.state)
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(self.webhook_url, json=payload, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                        logger.info("Webhook sent → %s (status %d)", self.webhook_url, resp.status)
            except Exception as e:
                logger.warning("Webhook failed: %s", e)

        self.state.mode = MachineMode.STANDBY
        self.state.brew_phase = BrewPhase.IDLE

    async def _brew_loop(self) -> None:
        """抽出シミュレーションループ（1秒刻み）."""
        try:
            while self.state.mode == MachineMode.BREW:
                finished = simulate_brew_tick(self.state)
                await self.broadcast(self._status_msg())
                if finished:
                    break
                await asyncio.sleep(1.0)
            await self._finish_brew()
            await self.broadcast(self._status_msg())
        except asyncio.CancelledError:
            logger.info("Brew cancelled")
            self.state.mode = MachineMode.STANDBY
            self.state.brew_phase = BrewPhase.IDLE
            self.state.pumping = False
            await self.broadcast(self._status_msg())

    # --- Request handlers ---

    async def handle_request(self, ws: ServerConnection, msg: dict) -> None:
        tp = msg.get("tp", "")
        rid = msg.get("rid")

        if tp == "req:brew:start":
            if self.state.mode == MachineMode.STANDBY:
                await self._start_brew()
                self._brew_task = asyncio.create_task(self._brew_loop())
                await ws.send(json.dumps({"tp": "res:brew:start", "rid": rid, "status": "ok"}))
            else:
                await ws.send(json.dumps({"tp": "res:brew:start", "rid": rid, "status": "error", "error": "Already brewing"}))

        elif tp == "req:brew:stop":
            if self._brew_task and not self._brew_task.done():
                self._brew_task.cancel()
                await ws.send(json.dumps({"tp": "res:brew:stop", "rid": rid, "status": "ok"}))
            else:
                await ws.send(json.dumps({"tp": "res:brew:stop", "rid": rid, "status": "error", "error": "Not brewing"}))

        elif tp == "req:profiles:list":
            await ws.send(json.dumps({
                "tp": "sub:profiles",
                "action": "list",
                "rid": rid,
                "profiles": [p.to_dict() for p in self.state.profiles],
                "selected_profile_id": self.state.selected_profile.id if self.state.selected_profile else None,
                "error": None,
            }))

        elif tp == "req:profile:select":
            profile_data = msg.get("profile")
            profile_id = msg.get("profile_id")
            if profile_data:
                # 新規プロファイル送信
                new_profile = Profile(
                    id=profile_data.get("id", f"profile_{uuid.uuid4().hex[:8]}"),
                    label=profile_data.get("label", "Custom"),
                    type=profile_data.get("type", "simple"),
                    temperature=profile_data.get("temperature", 93.0),
                    description=profile_data.get("description", ""),
                    is_favorite=False,
                    version=1,
                    phases=profile_data.get("phases", []),
                )
                self.state.selected_profile = new_profile
                logger.info("Profile selected (new): %s", new_profile.label)
            elif profile_id:
                found = next((p for p in self.state.profiles if p.id == profile_id), None)
                if found:
                    self.state.selected_profile = found
                    logger.info("Profile selected: %s", found.label)
            await ws.send(json.dumps({
                "tp": "sub:profiles",
                "action": "select",
                "rid": rid,
                "selected_profile_id": self.state.selected_profile.id if self.state.selected_profile else None,
                "error": None,
            }))

        elif tp == "req:profile:save":
            profile_data = msg.get("profile", {})
            new_profile = Profile(
                id=profile_data.get("id", f"profile_{uuid.uuid4().hex[:8]}"),
                label=profile_data.get("label", "Saved Profile"),
                type=profile_data.get("type", "simple"),
                temperature=profile_data.get("temperature", 93.0),
                description=profile_data.get("description", ""),
                is_favorite=profile_data.get("is_favorite", False),
                version=profile_data.get("version", 1),
                phases=profile_data.get("phases", []),
            )
            self.state.profiles.append(new_profile)
            logger.info("Profile saved: %s", new_profile.label)
            await ws.send(json.dumps({
                "tp": "sub:profiles",
                "action": "save",
                "rid": rid,
                "profiles": [p.to_dict() for p in self.state.profiles],
                "error": None,
            }))

        elif tp == "req:profile:delete":
            pid = msg.get("profile_id")
            self.state.profiles = [p for p in self.state.profiles if p.id != pid]
            logger.info("Profile deleted: %s", pid)
            await ws.send(json.dumps({
                "tp": "sub:profiles",
                "action": "delete",
                "rid": rid,
                "profiles": [p.to_dict() for p in self.state.profiles],
                "error": None,
            }))

        elif tp == "req:profile:favorite":
            pid = msg.get("profile_id")
            is_fav = msg.get("is_favorite", True)
            for p in self.state.profiles:
                if p.id == pid:
                    p.is_favorite = is_fav
                    logger.info("Profile %s favorite=%s", pid, is_fav)
            await ws.send(json.dumps({
                "tp": "sub:profiles",
                "action": "favorite",
                "rid": rid,
                "error": None,
            }))

        else:
            logger.warning("Unknown request type: %s", tp)
            await ws.send(json.dumps({"tp": "res:error", "rid": rid, "error": f"Unknown type: {tp}"}))

    # --- WebSocket connection handler ---

    async def ws_handler(self, ws: ServerConnection) -> None:
        self.clients.add(ws)
        remote = ws.remote_address
        logger.info("Client connected: %s", remote)

        # 接続時に現在のステータスを送信
        await ws.send(json.dumps(self._status_msg()))

        try:
            async for raw in ws:
                try:
                    msg = json.loads(raw)
                    await self.handle_request(ws, msg)
                except json.JSONDecodeError:
                    logger.warning("Invalid JSON from %s", remote)
        except websockets.ConnectionClosed:
            pass
        finally:
            self.clients.discard(ws)
            logger.info("Client disconnected: %s", remote)

    # --- Status broadcast loop ---

    async def status_loop(self) -> None:
        """スタンバイ中は2秒ごとにステータスをブロードキャスト."""
        while True:
            if self.state.mode == MachineMode.STANDBY:
                simulate_standby_heating(self.state)
                await self.broadcast(self._status_msg())
            await asyncio.sleep(2.0)

    # --- Main ---

    async def run(self) -> None:
        logger.info("GaggiMate Simulator starting...")
        logger.info("  WebSocket: ws://%s:%d/ws", self.host, self.ws_port)
        if self.webhook_url:
            logger.info("  Webhook URL: %s", self.webhook_url)
        logger.info("  Default profile: %s", self.state.selected_profile.label if self.state.selected_profile else "None")
        logger.info("  Profiles loaded: %d", len(self.state.profiles))

        async with websockets.serve(
            self.ws_handler,
            self.host,
            self.ws_port,
        ):
            logger.info("Simulator ready. Waiting for connections...")
            await self.status_loop()


# ---------------------------------------------------------------------------
# CLI Entry Point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="GaggiMate Pro Simulator")
    parser.add_argument("--host", default="0.0.0.0", help="Bind host (default: 0.0.0.0)")
    parser.add_argument("--ws-port", type=int, default=8765, help="WebSocket port (default: 8765)")
    parser.add_argument("--webhook-url", default=None, help="Webhook URL for shot completion (e.g. http://localhost:8000/webhook)")
    args = parser.parse_args()

    server = GaggiMateSimServer(
        host=args.host,
        ws_port=args.ws_port,
        webhook_url=args.webhook_url,
    )
    asyncio.run(server.run())


if __name__ == "__main__":
    main()
