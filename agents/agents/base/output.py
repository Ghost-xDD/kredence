from __future__ import annotations

from datetime import datetime
from typing import Any, Dict

from pydantic import BaseModel, Field


class BaseAgentOutput(BaseModel):
    agent_role: str
    evaluation_id: str
    confidence_score: float = Field(ge=0.0, le=100.0)
    raw_llm_response: str = ""
    metadata: Dict[str, Any] = Field(default_factory=dict)
    completed_at: datetime = Field(default_factory=datetime.utcnow)
