from sqlalchemy import select
from app.models.product import Product
from app.models.platform_listing import PlatformListing
from app.models.platform_account import PlatformAccount
from app.ai.analyzers.base import BaseAnalyzer, Suggestion
from app.ai.rules import get_rule


class ListingAnalyzer(BaseAnalyzer):
    async def analyze(self, user_id: str) -> list[Suggestion]:
        suggestions = []

        result = await self.db.execute(
            select(PlatformListing, PlatformAccount.platform)
            .join(Product, PlatformListing.product_id == Product.id)
            .join(PlatformAccount, PlatformListing.platform_account_id == PlatformAccount.id)
            .where(
                Product.user_id == user_id,
                PlatformListing.status == "active",
            )
        )
        listings = list(result.all())

        for listing, platform in listings:
            perf = listing.performance or {}
            views_30d = perf.get("views_30d")
            orders_30d = perf.get("orders_30d")

            # Dead listing: active but no sales
            if views_30d is not None and orders_30d == 0 and listing.status == "active":
                rule = get_rule("LISTING_DEAD")
                suggestions.append(Suggestion(
                    suggestion_type="LISTING_DEAD",
                    title=rule["title_template"].format(name=listing.title[:20]),
                    description=rule["desc_template"].format(
                        name=listing.title[:20], platform=platform or "平台",
                    ),
                    severity=rule["severity"],
                    confidence=0.6,
                    category=rule["type"],
                    related_entity_type="listing",
                    related_entity_id=listing.id,
                    source_refs=[{"type": "listing", "id": listing.id, "field": "performance.views_30d/orders_30d"}],
                    evidence_window="近30天 Listing 浏览和订单表现",
                    confidence_reason="Listing 有浏览数据且近30天订单为0，命中无销售规则",
                ))

            conv_before = perf.get("conversion_before")
            conv_after = perf.get("conversion_after")
            if conv_before and conv_after is not None and conv_after < conv_before * 0.8:
                rule = get_rule("LISTING_CONV_DROP")
                suggestions.append(Suggestion(
                    suggestion_type="LISTING_CONV_DROP",
                    title=rule["title_template"].format(name=listing.title[:20]),
                    description=rule["desc_template"].format(
                        name=listing.title[:20],
                        conv_before=conv_before, conv_after=conv_after,
                        drop_pct=(1 - conv_after / conv_before) * 100,
                    ),
                    severity=rule["severity"],
                    confidence=0.65,
                    category=rule["type"],
                    related_entity_type="listing",
                    related_entity_id=listing.id,
                    source_refs=[{"type": "listing", "id": listing.id, "field": "performance.conversion_before/conversion_after"}],
                    evidence_window="Listing 最近两个转化率观测窗口",
                    confidence_reason="后一个转化率窗口低于前一个窗口20%以上",
                    metrics_before={"conv_before": conv_before, "conv_after": conv_after},
                ))

        return suggestions
