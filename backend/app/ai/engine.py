import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.ai.analyzers.base import Suggestion
from app.ai.analyzers.pricing_analyzer import PricingAnalyzer
from app.ai.analyzers.inventory_analyzer import InventoryAnalyzer
from app.ai.analyzers.listing_analyzer import ListingAnalyzer
from app.ai.analyzers.trend_analyzer import TrendAnalyzer
from app.ai.analyzers.cross_platform_analyzer import CrossPlatformAnalyzer
from app.models.ai_suggestion import AISuggestion

logger = logging.getLogger(__name__)


class AIEngine:
    """Orchestrates all analyzers and produces ranked, deduplicated suggestions."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.analyzers = [
            PricingAnalyzer(db),
            InventoryAnalyzer(db),
            ListingAnalyzer(db),
            TrendAnalyzer(db),
            CrossPlatformAnalyzer(db),
        ]

    async def run_analysis(self, user_id: str) -> list[AISuggestion]:
        all_suggestions = []

        for analyzer in self.analyzers:
            try:
                suggestions = await analyzer.analyze(user_id)
                all_suggestions.extend(suggestions)
            except Exception as e:
                logger.error(f"Analyzer {analyzer.__class__.__name__} failed: {e}")

        # Deduplicate: skip if same type + entity already has active suggestion
        existing = await self.db.execute(
            select(AISuggestion).where(
                AISuggestion.user_id == user_id,
                AISuggestion.is_dismissed == False,
                AISuggestion.is_applied == False,
            )
        )
        existing_active = existing.scalars().all()
        active_keys = {
            (s.suggestion_type, s.related_entity_id)
            for s in existing_active
        }

        # Sort: critical first, then by confidence
        severity_order = {"critical": 0, "warning": 1, "info": 2}
        all_suggestions.sort(
            key=lambda s: (severity_order.get(s.severity, 3), -s.confidence)
        )

        # Persist new suggestions
        created = []
        for sug in all_suggestions:
            key = (sug.suggestion_type, sug.related_entity_id)
            if key in active_keys:
                continue

            entity = AISuggestion(
                user_id=user_id,
                suggestion_type=sug.suggestion_type,
                title=sug.title,
                description=sug.description,
                severity=sug.severity,
                confidence=sug.confidence,
                category=sug.category,
                related_entity_type=sug.related_entity_type,
                related_entity_id=sug.related_entity_id,
                source_refs=sug.source_refs or _default_source_refs(sug),
                evidence_window=sug.evidence_window or _default_evidence_window(sug),
                confidence_reason=sug.confidence_reason or _default_confidence_reason(sug),
                metrics_before=sug.metrics_before,
            )
            self.db.add(entity)
            created.append(entity)

        await self.db.commit()
        for entity in created:
            await self.db.refresh(entity)

        return created


def _default_source_refs(sug: Suggestion) -> list[dict]:
    if not sug.related_entity_type or not sug.related_entity_id:
        return []
    return [{"type": sug.related_entity_type, "id": sug.related_entity_id}]


def _default_evidence_window(sug: Suggestion) -> str:
    if sug.suggestion_type.startswith(("STOCK_", "LISTING_")):
        return "近30天平台 Listing 表现数据"
    if sug.suggestion_type.startswith("PRICE_"):
        return "当前竞品价格样本"
    if sug.suggestion_type.startswith("TREND_"):
        return "最近一次趋势采集窗口"
    return "当前系统数据快照"


def _default_confidence_reason(sug: Suggestion) -> str:
    metric_count = len(sug.metrics_before or {})
    if metric_count:
        return f"基于 {metric_count} 个已采集指标命中规则，置信度 {sug.confidence:.0%}"
    return f"基于已关联实体命中规则，置信度 {sug.confidence:.0%}"
