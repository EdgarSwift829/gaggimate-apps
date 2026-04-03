"""SQLiteデータベース管理."""

from __future__ import annotations

import aiosqlite
from pathlib import Path

from app.config import settings

SCHEMA_SQL = """
-- 豆マスター
CREATE TABLE IF NOT EXISTS beans (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    roaster     TEXT,
    roast_date  TEXT,       -- ISO 8601 (YYYY-MM-DD)
    origin      TEXT,
    notes       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- レシピ（バージョン管理・お気に入り含む）
CREATE TABLE IF NOT EXISTS recipes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    json        TEXT NOT NULL,       -- GaggiMate プロファイルJSON
    version     INTEGER NOT NULL DEFAULT 1,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    avg_score   REAL,
    use_count   INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ショット1件のマスター
CREATE TABLE IF NOT EXISTS shots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp   TEXT NOT NULL DEFAULT (datetime('now')),
    duration    REAL,               -- 抽出時間（秒）
    recipe_id   INTEGER REFERENCES recipes(id),
    bean_id     INTEGER REFERENCES beans(id),
    dose_g      REAL,               -- ドーズ量（g）
    yield_g     REAL,               -- 抽出量（g）
    yield_ratio REAL,               -- 収率（yield / dose）
    score       INTEGER CHECK (score BETWEEN 1 AND 5),
    feedback    TEXT,               -- ユーザー感想（自由記述）
    webhook_payload TEXT,           -- GaggiMateからの生Webhook JSON
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 1秒ごとの時系列データ
CREATE TABLE IF NOT EXISTS shot_timeseries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    shot_id     INTEGER NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
    t           REAL NOT NULL,      -- 経過時間（秒）
    pressure    REAL,               -- 圧力（bar）
    temp        REAL,               -- 温度（°C）
    weight      REAL,               -- 重量（g）
    flow        REAL                -- フロー（ml/s）
);
CREATE INDEX IF NOT EXISTS idx_timeseries_shot ON shot_timeseries(shot_id);

-- グラインド情報
CREATE TABLE IF NOT EXISTS grind_settings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    shot_id     INTEGER NOT NULL UNIQUE REFERENCES shots(id) ON DELETE CASCADE,
    clicks      INTEGER,            -- コマンダンテ クリック数
    dose_g      REAL,               -- ドーズ量（g）
    yield_g     REAL                -- 抽出量（g）
);

-- LLM提案履歴
CREATE TABLE IF NOT EXISTS llm_suggestions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    shot_id     INTEGER REFERENCES shots(id) ON DELETE SET NULL,
    prompt      TEXT NOT NULL,
    response    TEXT NOT NULL,
    model       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_llm_shot ON llm_suggestions(shot_id);

-- Web Push購読情報
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint          TEXT NOT NULL UNIQUE,
    subscription_json TEXT NOT NULL,
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


async def get_db() -> aiosqlite.Connection:
    """DB接続を取得. FastAPIのDependencyとして使用."""
    db_path = Path(settings.db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    db = await aiosqlite.connect(str(db_path))
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db


async def init_db() -> None:
    """テーブル作成（アプリ起動時に呼ぶ）."""
    db = await get_db()
    try:
        await db.executescript(SCHEMA_SQL)
        await db.commit()
    finally:
        await db.close()
