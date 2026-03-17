from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("")
async def list_agents() -> dict:
    # Phase 3 will populate from ERC-8004 Identity Registry + on-chain reputation
    return {"agents": []}
