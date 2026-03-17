from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class EvidenceSourceIn(BaseModel):
    source_type: str
    url: Optional[str] = None
    file_name: Optional[str] = None


class EvaluationCreateRequest(BaseModel):
    project_name: str
    sources: List[EvidenceSourceIn]


class EvaluationResponse(BaseModel):
    id: str
    project_name: str
    status: str
    final_verdict: Optional[str] = None
    confidence_score: Optional[float] = None
    hypercert_payload: Optional[Dict[str, Any]] = None
    archive_cid: Optional[str] = None
    anchor_tx_hash: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AgentOutputResponse(BaseModel):
    id: str
    agent_role: str
    agent_id: Optional[str] = None
    confidence_score: Optional[float] = None
    output_json: Optional[Dict[str, Any]] = None
    storacha_cid: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class HealthResponse(BaseModel):
    status: str
    version: str
