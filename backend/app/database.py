"""SQLite database initialization and connection management."""

import aiosqlite
import os
from pathlib import Path

DB_DIR = Path(os.getenv("GAGGIMATE_DB_DIR", Path(__file__).parent.parent / "data"))
DB_PATH = DB_DIR / "gaggimate.db"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS beans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    roaster TEXT,
    roast_date TEXT,
    origin TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    json TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    avg_score REAL,
    use_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    duration REAL,
    recipe_id INTEGER REFERENCES recipes(id),
    bean_id INTEGER REFERENCES beans(id),
    score INTEGER CHECK (score BETWEEN 1 AND 5),
    feedback TEXT,
    yield_g REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shot_timeseries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shot_id INTEGER NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
    t REAL NOT NULL,
    pressure REAL,
    temp REAL,
    weight REAL,
    flow REAL
);

CREATE TABLE IF NOT EXISTS grind_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shot_id INTEGER NOT NULL UNIQUE REFERENCES shots(id) ON DELETE CASCADE,
    clicks INTEGER,
    dose_g REAL,
    yield_g REAL
);

CREATE TABLE IF NOT EXISTS llm_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shot_id INTEGER NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_shot_timeseries_shot_id ON shot_timeseries(shot_id);
CREATE INDEX IF NOT EXISTS idx_shots_bean_id ON shots(bean_id);
CREATE INDEX IF NOT EXISTS idx_shots_recipe_id ON shots(recipe_id);
CREATE INDEX IF NOT EXISTS idx_shots_timestamp ON shots(timestamp);
"""


async def get_db() -> aiosqlite.Connection:
    """Get a database connection (used as FastAPI dependency)."""
    DB_DIR.mkdir(parents=True, exist_ok=True)
    db = await aiosqlite.connect(str(DB_PATH))
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    try:
        yield db
    finally:
        await db.close()


async def init_db():
    """Initialize database schema."""
    DB_DIR.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(str(DB_PATH)) as db:
        await db.executescript(SCHEMA_SQL)
        await db.commit()
