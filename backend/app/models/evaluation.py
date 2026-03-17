from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class Evaluation(Base):
    __tablename__ = "evaluations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    project_name: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="pending")
    final_verdict: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    hypercert_payload: Mapped[Optional[Dict]] = mapped_column(JSON, nullable=True)
    archive_cid: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    anchor_tx_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sources: Mapped[List["EvidenceSource"]] = relationship("EvidenceSource", back_populates="evaluation", cascade="all, delete-orphan")
    agent_outputs: Mapped[List["AgentOutput"]] = relationship("AgentOutput", back_populates="evaluation", cascade="all, delete-orphan")
    storacha_refs: Mapped[List["StorachaRef"]] = relationship("StorachaRef", back_populates="evaluation", cascade="all, delete-orphan")


class EvidenceSource(Base):
    __tablename__ = "evidence_sources"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    evaluation_id: Mapped[str] = mapped_column(String, ForeignKey("evaluations.id"), nullable=False)
    source_type: Mapped[str] = mapped_column(String, nullable=False)
    url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    file_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    raw_content: Mapped[str] = mapped_column(Text, default="")
    metadata_: Mapped[Optional[Dict]] = mapped_column("metadata", JSON, nullable=True)
    storacha_cid: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    evaluation: Mapped["Evaluation"] = relationship("Evaluation", back_populates="sources")


class AgentOutput(Base):
    __tablename__ = "agent_outputs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    evaluation_id: Mapped[str] = mapped_column(String, ForeignKey("evaluations.id"), nullable=False)
    agent_role: Mapped[str] = mapped_column(String, nullable=False)
    agent_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    operator_wallet: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    input_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    output_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    output_json: Mapped[Optional[Dict]] = mapped_column(JSON, nullable=True)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    storacha_cid: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    lit_signature: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    lit_signature_cid: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    evaluation: Mapped["Evaluation"] = relationship("Evaluation", back_populates="agent_outputs")


class StorachaRef(Base):
    __tablename__ = "storacha_refs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    evaluation_id: Mapped[str] = mapped_column(String, ForeignKey("evaluations.id"), nullable=False)
    label: Mapped[str] = mapped_column(String, nullable=False)
    cid: Mapped[str] = mapped_column(String, nullable=False)
    url: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    evaluation: Mapped["Evaluation"] = relationship("Evaluation", back_populates="storacha_refs")
