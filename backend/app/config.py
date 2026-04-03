"""Application configuration."""

import os


class Settings:
    # GaggiMate connection
    GAGGIMATE_WS_URL: str = os.getenv("GAGGIMATE_WS_URL", "ws://gaggimate.local/ws")
    GAGGIMATE_MQTT_HOST: str = os.getenv("GAGGIMATE_MQTT_HOST", "gaggimate.local")
    GAGGIMATE_MQTT_PORT: int = int(os.getenv("GAGGIMATE_MQTT_PORT", "1883"))

    # LM Studio
    LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "http://localhost:1234/v1")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "local-model")

    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]


settings = Settings()
