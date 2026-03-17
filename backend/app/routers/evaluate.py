from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.evaluation import Evaluation, EvidenceSource
from app.schemas.evaluation import AgentOutputResponse, EvaluationCreateRequest, EvaluationResponse

router = APIRouter(prefix="/evaluate", tags=["evaluate"])


@router.post("", response_model=EvaluationResponse, status_code=201)
async def create_evaluation(
    payload: EvaluationCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> Evaluation:
    evaluation = Evaluation(
        id=str(uuid.uuid4()),
        project_name=payload.project_name,
        status="pending",
    )
    for src in payload.sources:
        evaluation.sources.append(
            EvidenceSource(
                source_type=src.source_type,
                url=src.url,
                file_name=src.file_name,
            )
        )
    db.add(evaluation)
    await db.commit()
    await db.refresh(evaluation)
    return evaluation


@router.get("/{evaluation_id}", response_model=EvaluationResponse)
async def get_evaluation(
    evaluation_id: str,
    db: AsyncSession = Depends(get_db),
) -> Evaluation:
    result = await db.execute(select(Evaluation).where(Evaluation.id == evaluation_id))
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    return evaluation
