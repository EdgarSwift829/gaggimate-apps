"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_db
from .routers import shots, beans, recipes, llm, gaggimate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing database...")
    await init_db()

    logger.info("Connecting to GaggiMate at %s...", settings.GAGGIMATE_WS_URL)
    try:
        await gaggimate.gaggimate_client.connect()
    except Exception as e:
        logger.warning("Could not connect to GaggiMate: %s (will retry in background)", e)

    yield

    # Shutdown
    await gaggimate.gaggimate_client.disconnect()


app = FastAPI(
    title="GaggiMate Integration App",
    description="Gaggia Classic E24 + GaggiMate Pro + ローカルLLM連携アプリ",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(shots.router, prefix="/api")
app.include_router(beans.router, prefix="/api")
app.include_router(recipes.router, prefix="/api")
app.include_router(llm.router, prefix="/api")
app.include_router(gaggimate.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
