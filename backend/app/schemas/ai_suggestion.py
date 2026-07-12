from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class AISuggestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    suggestion_type: str
    title: str
    description: str
    severity: str
    confidence: Optional[float] = None
    category: Optional[str] = None
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[str] = None
    source_refs: list[dict] = Field(default_factory=list)
    evidence_window: Optional[str] = None
    confidence_reason: Optional[str] = None
    is_read: bool = False
    is_applied: bool = False
    is_dismissed: bool = False
    created_at: Optional[datetime] = None
