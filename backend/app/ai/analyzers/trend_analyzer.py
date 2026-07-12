from sqlalchemy import or_, select

from app.ai.analyzers.base import BaseAnalyzer, Suggestion
from app.ai.rules import get_rule
from app.models.trend_keyword import TrendKeyword


class TrendAnalyzer(BaseAnalyzer):
    async def analyze(self, user_id: str) -> list[Suggestion]:
        """Detect keyword/category trends from collected trend keywords."""
        suggestions = []

        result = await self.db.execute(
            select(TrendKeyword)
            .where(
                or_(TrendKeyword.user_id == user_id, TrendKeyword.user_id.is_(None)),
                TrendKeyword.growth_pct.is_not(None),
                TrendKeyword.source != "fallback",
            )
            .order_by(TrendKeyword.growth_pct.desc())
            .limit(20)
        )
        trends = list(result.scalars().all())

        for trend in trends:
            surge = trend.growth_pct or 0
            if surge < 80:
                continue
            rule = get_rule("TREND_SURGE")
            suggestions.append(Suggestion(
                suggestion_type="TREND_SURGE",
                title=rule["title_template"].format(keyword=trend.keyword),
                description=rule["desc_template"].format(
                    keyword=trend.keyword, surge_pct=surge,
                ),
                severity="info",
                confidence=0.65,
                category="trend",
                related_entity_type="trend_keyword",
                related_entity_id=trend.id,
                source_refs=[{
                    "type": "trend_keyword",
                    "id": trend.id,
                    "source": trend.source,
                    "market": trend.market,
                }],
                evidence_window=trend.last_fetched_at.isoformat() if trend.last_fetched_at else "最近一次趋势采集窗口",
                confidence_reason=f"趋势关键词增长 {surge:.0f}%，来源为 {trend.source}",
                metrics_before={
                    "surge_pct": surge,
                    "market": trend.market,
                    "category": trend.category,
                    "source": trend.source,
                },
            ))

        return suggestions
