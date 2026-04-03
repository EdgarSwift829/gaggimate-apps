"""GaggiMate連携アプリ バックエンド（FastAPI）."""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import shots, beans, recipes, webhook, machine, llm_api, notifications
from app.services.gaggimate_ws import gaggimate_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("main")

app = FastAPI(title="GaggiMate App", version="0.1.0")

# CORS（React dev server）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーター登録
app.include_router(shots.router)
app.include_router(beans.router)
app.include_router(recipes.router)
app.include_router(webhook.router)
app.include_router(machine.router)
app.include_router(llm_api.router)
app.include_router(notifications.router)

# --- フロントエンド向けWebSocket（リアルタイムステータス中継）---

ws_clients: set[WebSocket] = set()


async def _forward_to_clients(data: dict) -> None:
    """GaggiMateからのステータスをフロントエンドに中継."""
    global ws_clients
    if data.get("tp") != "sub:status":
        return
    dead = set()
    msg = json.dumps(data)
    for client in ws_clients:
        try:
            await client.send_text(msg)
        except Exception:
            dead.add(client)
    ws_clients -= dead


@app.websocket("/ws/status")
async def ws_status(websocket: WebSocket):
    """フロントエンドがリアルタイムステータスを受信するWebSocket."""
    await websocket.accept()
    ws_clients.add(websocket)
    logger.info("Frontend WS client connected (%d total)", len(ws_clients))
    try:
        while True:
            await websocket.receive_text()  # keep-alive
    except WebSocketDisconnect:
        pass
    finally:
        ws_clients.discard(websocket)
        logger.info("Frontend WS client disconnected (%d remaining)", len(ws_clients))


# --- Lifecycle ---

@app.on_event("startup")
async def startup():
    logger.info("Initializing database...")
    await init_db()
    logger.info("Database ready")

    # GaggiMate WebSocket接続（バックグラウンド）
    gaggimate_client.add_listener(_forward_to_clients)
    asyncio.create_task(gaggimate_client.connect())
    logger.info("GaggiMate WS client started in background")


@app.on_event("shutdown")
async def shutdown():
    await gaggimate_client.disconnect()


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "gaggimate_connected": gaggimate_client.ws is not None,
        "gaggimate_brewing": gaggimate_client.is_brewing,
    }
