"""アプリケーション設定."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Settings:
    gaggimate_host: str = "localhost"
    gaggimate_ws_port: int = 8766
    webhook_listen_port: int = 8001
    lm_studio_base_url: str = "http://localhost:1234/v1"
    lm_studio_model: str = "local-model"
    db_path: str = "data/gaggimate.db"
    mqtt_broker: str = "localhost"
    mqtt_port: int = 1883
    mqtt_enabled: bool = False
    line_notify_token: str | None = None

    _config_path: Path = field(default=Path("config.json"), init=False, repr=False, compare=False)

    def save(self) -> None:
        """現在の設定値を config.json に書き戻す."""
        try:
            with self._config_path.open() as f:
                data: dict = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            data = {}

        for fname in self.__dataclass_fields__:
            if fname.startswith("_"):
                continue
            data[fname] = getattr(self, fname)

        with self._config_path.open("w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")

    @classmethod
    def load(cls, path: str | Path = "config.json") -> Settings:
        p = Path(path)
        kwargs: dict = {}
        if p.exists():
            with p.open() as f:
                data = json.load(f)
            kwargs = {k: v for k, v in data.items() if k in cls.__dataclass_fields__}

        # 環境変数でオーバーライド（Docker対応）
        env_map = {
            "GAGGIMATE_HOST": "gaggimate_host",
            "GAGGIMATE_WS_PORT": "gaggimate_ws_port",
            "LM_STUDIO_BASE_URL": "lm_studio_base_url",
            "LM_STUDIO_MODEL": "lm_studio_model",
            "DB_PATH": "db_path",
            "MQTT_BROKER": "mqtt_broker",
            "MQTT_PORT": "mqtt_port",
            "MQTT_ENABLED": "mqtt_enabled",
        }
        for env_key, field_name in env_map.items():
            val = os.environ.get(env_key)
            if val is not None:
                field_type = cls.__dataclass_fields__[field_name].type
                if field_type == "int":
                    kwargs[field_name] = int(val)
                elif field_type == "bool":
                    kwargs[field_name] = val.lower() in ("1", "true", "yes")
                else:
                    kwargs[field_name] = val

        instance = cls(**kwargs)
        instance._config_path = Path(path)
        return instance


settings = Settings.load(Path(__file__).parent.parent / "config.json")
