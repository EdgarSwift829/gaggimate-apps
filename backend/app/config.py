"""アプリケーション設定."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Settings:
    gaggimate_host: str = "localhost"
    gaggimate_ws_port: int = 8765
    webhook_listen_port: int = 8000
    lm_studio_base_url: str = "http://localhost:1234/v1"
    lm_studio_model: str = "local-model"
    db_path: str = "data/gaggimate.db"
    mqtt_broker: str = "localhost"
    mqtt_port: int = 1883

    @classmethod
    def load(cls, path: str | Path = "config.json") -> Settings:
        p = Path(path)
        if p.exists():
            with p.open() as f:
                data = json.load(f)
            return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
        return cls()


settings = Settings.load(Path(__file__).parent.parent / "config.json")
