"""Shared evidence-chain schemas used by business and AI outputs."""

from typing import Any, Optional

from pydantic import BaseModel, Field


class SourceRef(BaseModel):
    type: str
    id: Optional[str] = None
    field: Optional[str] = None
    label: Optional[str] = None
    fields: list[str] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)


class EvidenceChain(BaseModel):
    source_refs: list[SourceRef] = Field(default_factory=list)
    evidence_window: Optional[str] = None
    confidence_reason: Optional[str] = None
    data_gaps: list[str] = Field(default_factory=list)


class EvidenceStatus(BaseModel):
    status: str
    message: Optional[str] = None
    evidence: EvidenceChain = Field(default_factory=EvidenceChain)
