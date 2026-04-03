"""GaggiMate Webhook受信エンドポイント."""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Request

from app.database import get_db
from app.services.gaggimate_ws import gaggimate_client

logger = logging.getLogger("webhook")
router = APIRouter(tags=["webhook"])


@router.post("/webhook")
async def receive_webhook(request: Request):
    """GaggiMateからのショット完了Webhookを受信してDBに保存."""
    payload = await request.json()
    event = payload.get("event")

    if event != "shot_complete":
        logger.info("Ignoring webhook event: %s", event)
        return {"ok": True, "ignored": True}

    logger.info("Shot complete webhook received: %s", payload.get("shot_id"))

    db = await get_db()
    try:
        # ショットレコード作成
        profile_used = payload.get("profile_used", {})

        # レシピをrecipesテーブルから検索（なければNone）
        recipe_id = None
        if profile_used.get("label"):
            row = await db.execute(
                "SELECT id FROM recipes WHERE name = ? ORDER BY version DESC LIMIT 1",
                [profile_used["label"]],
            )
            found = await row.fetchone()
            if found:
                recipe_id = found["id"]

        cursor = await db.execute(
            """INSERT INTO shots (timestamp, duration, recipe_id, yield_g, yield_ratio, webhook_payload)
               VALUES (?, ?, ?, ?, ?, ?)""",
            [
                payload.get("timestamp"),
                payload.get("duration"),
                recipe_id,
                payload.get("yield"),
                payload.get("yield_ratio"),
                json.dumps(payload, ensure_ascii=False),
            ],
        )
        shot_id = cursor.lastrowid

        # テレメトリ → shot_timeseries
        telemetry = payload.get("telemetry", {})
        pressure_pts = telemetry.get("pressure_points", [])
        temp_pts = {p["t"]: p["value"] for p in telemetry.get("temperature_points", [])}
        flow_pts = {p["t"]: p["value"] for p in telemetry.get("flow_points", [])}
        weight_pts = {p["t"]: p["value"] for p in telemetry.get("weight_points", [])}

        for pt in pressure_pts:
            t = pt["t"]
            await db.execute(
                "INSERT INTO shot_timeseries (shot_id, t, pressure, temp, weight, flow) VALUES (?, ?, ?, ?, ?, ?)",
                [shot_id, t, pt["value"], temp_pts.get(t), weight_pts.get(t), flow_pts.get(t)],
            )

        await db.commit()

        # WebSocketバッファをクリア（次のbrewに備える）
        gaggimate_client.clear_brew_buffer()
        logger.info("Shot %d saved with %d timeseries points", shot_id, len(pressure_pts))

        return {"ok": True, "shot_id": shot_id}
    finally:
        await db.close()
