from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import agents, evaluate, export, stream

app = FastAPI(
    title="Credence API",
    description="Multi-agent impact evaluation pipeline",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(evaluate.router)
app.include_router(stream.router)
app.include_router(agents.router)
app.include_router(export.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "version": "0.1.0"}
