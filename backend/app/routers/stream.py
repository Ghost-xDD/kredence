from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

router = APIRouter(prefix="/evaluate", tags=["stream"])


@router.get("/{evaluation_id}/stream")
async def stream_evaluation(evaluation_id: str) -> EventSourceResponse:
    async def event_generator():
        # Placeholder — Phase 2 wires up the real AgentEventBus here
        yield {"event": "connected", "data": json.dumps({"evaluation_id": evaluation_id})}
        await asyncio.sleep(0)

    return EventSourceResponse(event_generator())
