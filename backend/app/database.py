"""SQLiteデータベース管理."""

from __future__ import annotations

import aiosqlite
import json as json_lib
from pathlib import Path

from app.config import settings

_DEFAULT_RECIPES = [
    {
        "name": "ハンドエスプレッソ風（蒸らし）",
        "extractionTimeSec": 30, "targetVolumeMl": 32,
        "curves": {
            "temp":     [{"t": 0, "v": 93}, {"t": 30, "v": 93}],
            "pressure": [{"t": 0, "v": 3}, {"t": 3, "v": 3}, {"t": 8, "v": 9}, {"t": 30, "v": 9}],
            "flow":     [{"t": 0, "v": 1.75}, {"t": 3, "v": 1.75}, {"t": 8, "v": 2.5}, {"t": 30, "v": 2.5}],
        },
    },
    {
        "name": "低圧スロー",
        "extractionTimeSec": 40, "targetVolumeMl": 32,
        "curves": {
            "temp":     [{"t": 0, "v": 91}, {"t": 40, "v": 91}],
            "pressure": [{"t": 0, "v": 2}, {"t": 5, "v": 6}, {"t": 40, "v": 6}],
            "flow":     [{"t": 0, "v": 1}, {"t": 5, "v": 1.5}, {"t": 40, "v": 1.5}],
        },
    },
    {
        "name": "ターボショット",
        "extractionTimeSec": 18, "targetVolumeMl": 32,
        "curves": {
            "temp":     [{"t": 0, "v": 94}, {"t": 18, "v": 94}],
            "pressure": [{"t": 0, "v": 4}, {"t": 3, "v": 9}, {"t": 18, "v": 9}],
            "flow":     [{"t": 0, "v": 2}, {"t": 3, "v": 3.5}, {"t": 18, "v": 3.5}],
        },
    },
    {
        "name": "ディクリーニング（レバー風）",
        "extractionTimeSec": 33, "targetVolumeMl": 32,
        "curves": {
            "temp":     [{"t": 0, "v": 92}, {"t": 33, "v": 92}],
            "pressure": [{"t": 0, "v": 4}, {"t": 8, "v": 4}, {"t": 13, "v": 9}, {"t": 33, "v": 4}],
            "flow":     [{"t": 0, "v": 1.5}, {"t": 8, "v": 1.5}, {"t": 13, "v": 2}, {"t": 33, "v": 1.25}],
        },
    },
    {
        "name": "トロトロ（赤石スタイル）",
        "extractionTimeSec": 35, "targetVolumeMl": 23,
        "curves": {
            "temp":     [{"t": 0, "v": 89}, {"t": 35, "v": 89}],
            "pressure": [{"t": 0, "v": 3}, {"t": 5, "v": 3}, {"t": 10, "v": 9}, {"t": 35, "v": 6}],
            "flow":     [{"t": 0, "v": 1}, {"t": 5, "v": 1}, {"t": 10, "v": 1.5}, {"t": 35, "v": 0.9}],
        },
    },
]

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
    is_community INTEGER NOT NULL DEFAULT 0,
    source      TEXT,
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


async def _migrate_recipes_columns(db: aiosqlite.Connection) -> None:
    """recipes テーブルに新カラムを追加（既存DBマイグレーション用）."""
    cursor = await db.execute("PRAGMA table_info(recipes)")
    columns = {row[1] for row in await cursor.fetchall()}
    if "is_community" not in columns:
        await db.execute("ALTER TABLE recipes ADD COLUMN is_community INTEGER NOT NULL DEFAULT 0")
    if "source" not in columns:
        await db.execute("ALTER TABLE recipes ADD COLUMN source TEXT")
    if "is_archived" not in columns:
        await db.execute("ALTER TABLE recipes ADD COLUMN is_archived INTEGER DEFAULT 0")
    if "archived_at" not in columns:
        await db.execute("ALTER TABLE recipes ADD COLUMN archived_at TEXT")


async def init_db() -> None:
    """テーブル作成 + デフォルトレシピ挿入（アプリ起動時に呼ぶ）."""
    db = await get_db()
    try:
        await db.executescript(SCHEMA_SQL)
        await _migrate_recipes_columns(db)
        for recipe in _DEFAULT_RECIPES:
            await db.execute(
                "INSERT OR IGNORE INTO recipes (name, json, version, is_favorite)"
                " SELECT ?, ?, 1, 0 WHERE NOT EXISTS (SELECT 1 FROM recipes WHERE name = ?)",
                [recipe["name"], json_lib.dumps(recipe), recipe["name"]],
            )
        await db.commit()
    finally:
        await db.close()
