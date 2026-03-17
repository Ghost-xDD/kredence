from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.evaluation import Evaluation

router = APIRouter(prefix="/evaluate", tags=["export"])


@router.get("/{evaluation_id}/export/hypercert")
async def export_hypercert(
    evaluation_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(select(Evaluation).where(Evaluation.id == evaluation_id))
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    if not evaluation.hypercert_payload:
        raise HTTPException(status_code=404, detail="Hypercert not yet generated for this evaluation")
    return evaluation.hypercert_payload
