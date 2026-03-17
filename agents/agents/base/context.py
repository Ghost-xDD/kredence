from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class EvidenceSource(BaseModel):
    source_type: str  # github | url | pdf | contract
    url: Optional[str] = None
    file_name: Optional[str] = None
    raw_content: str = ""
    metadata: Dict[str, Any] = Field(default_factory=dict)


class EvidenceWorkspace(BaseModel):
    evaluation_id: str
    project_name: str
    sources: List[EvidenceSource] = Field(default_factory=list)
    combined_context: str = ""
    source_count: int = 0


class AgentContext(BaseModel):
    evaluation_id: str
    workspace: EvidenceWorkspace
    agent_identity: Dict[str, Any] = Field(default_factory=dict)
    prior_outputs: Dict[str, Any] = Field(default_factory=dict)
    # Phase 4: Storacha CIDs for each prior agent output
    workspace_cid: Optional[str] = None
    prior_cids: Dict[str, str] = Field(default_factory=dict)
    memory: Dict[str, Any] = Field(default_factory=dict)
