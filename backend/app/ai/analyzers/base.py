from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Suggestion:
    suggestion_type: str
    title: str
    description: str
    severity: str  # critical, warning, info
    confidence: float
    category: str
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[str] = None
    source_refs: list[dict] = field(default_factory=list)
    evidence_window: Optional[str] = None
    confidence_reason: Optional[str] = None
    metrics_before: dict = field(default_factory=dict)


class BaseAnalyzer(ABC):
    """Base class for all AI suggestion analyzers."""

    def __init__(self, db):
        self.db = db

    @abstractmethod
    async def analyze(self, user_id: str) -> list[Suggestion]:
        ...
