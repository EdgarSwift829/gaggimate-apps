"""GaggiMate machine state, brew commands, and webhook receiver."""

from fastapi import APIRouter, Depends, Request
import aiosqlite

from ..database import get_db
from ..models import MachineState, BrewCommand, ShotCreate
from ..services.gaggimate_ws import gaggimate_client

router = APIRouter(prefix="/gaggimate", tags=["gaggimate"])


@router.get("/state", response_model=MachineState)
async def get_machine_state():
    """Get current machine state (temperature, pressure, status)."""
    return gaggimate_client.state


@router.post("/brew")
async def brew_command(cmd: BrewCommand, db: aiosqlite.Connection = Depends(get_db)):
    """Send brew start/stop command to GaggiMate."""
    if cmd.action == "start":
        if cmd.recipe_id:
            cursor = await db.execute(
                "SELECT json FROM recipes WHERE id = ?", [cmd.recipe_id]
            )
            row = await cursor.fetchone()
            if row:
                await gaggimate_client.send_recipe(dict(row)["json"])
        await gaggimate_client.send_command("start")
        return {"status": "brewing"}
    elif cmd.action == "stop":
        await gaggimate_client.send_command("stop")
        return {"status": "stopped"}
    return {"status": "unknown_action"}


@router.post("/webhook")
async def webhook_shot_end(request: Request, db: aiosqlite.Connection = Depends(get_db)):
    """Receive shot-end webhook from GaggiMate (v1.6.0+).
    Saves buffered timeseries data to a new shot record."""
    body = await request.json()

    buffer = gaggimate_client.take_shot_buffer()
    duration = body.get("duration") or (buffer[-1].t if buffer else None)

    shot = ShotCreate(
        duration=duration,
        recipe_id=body.get("recipe_id"),
        yield_g=body.get("yield"),
        timeseries=buffer,
    )

    # Re-use shot creation logic
    cursor = await db.execute(
        "INSERT INTO shots (duration, recipe_id, yield_g) VALUES (?, ?, ?)",
        [shot.duration, shot.recipe_id, shot.yield_g],
    )
    shot_id = cursor.lastrowid

    if buffer:
        await db.executemany(
            "INSERT INTO shot_timeseries (shot_id, t, pressure, temp, weight, flow) VALUES (?, ?, ?, ?, ?, ?)",
            [(shot_id, p.t, p.pressure, p.temp, p.weight, p.flow) for p in buffer],
        )

    await db.commit()
    return {"shot_id": shot_id, "timeseries_points": len(buffer)}
