from sqlalchemy import select
from app.models.product import Product
from app.models.platform_listing import PlatformListing
from app.ai.analyzers.base import BaseAnalyzer, Suggestion
from app.ai.rules import get_rule


class InventoryAnalyzer(BaseAnalyzer):
    async def analyze(self, user_id: str) -> list[Suggestion]:
        suggestions = []

        result = await self.db.execute(
            select(PlatformListing).join(Product).where(
                Product.user_id == user_id,
                PlatformListing.status == "active",
            )
        )
        listings = list(result.scalars().all())

        for listing in listings:
            if (listing.platform_data or {}).get("stock_status") == "missing":
                continue
            stock = listing.stock
            perf = listing.performance or {}
            orders_30d = perf.get("orders_30d")
            if orders_30d is None:
                continue
            daily_sales = orders_30d / 30 if orders_30d > 0 else 0
            monthly_sales = int(daily_sales * 30)

            if 0 < stock < 5 and daily_sales > 0:
                rule = get_rule("STOCK_LOW")
                days = int(stock / daily_sales) if daily_sales > 0 else 99
                suggestions.append(Suggestion(
                    suggestion_type="STOCK_LOW",
                    title=rule["title_template"].format(name=listing.title[:20], stock=stock),
                    description=rule["desc_template"].format(
                        name=listing.title[:20], stock=stock,
                        daily_sales=daily_sales, days=days,
                    ),
                    severity=rule["severity"],
                    confidence=0.9,
                    category=rule["type"],
                    related_entity_type="listing",
                    related_entity_id=listing.id,
                    source_refs=[{"type": "listing", "id": listing.id, "field": "performance.orders_30d"}],
                    evidence_window="近30天 Listing 订单表现",
                    confidence_reason="库存小于5且近30天存在真实订单，按日均销量估算断货天数",
                    metrics_before={"stock": stock, "daily_sales": daily_sales, "orders_30d": orders_30d},
                ))

            if stock > 200 and monthly_sales < 10:
                rule = get_rule("STOCK_OVER")
                suggestions.append(Suggestion(
                    suggestion_type="STOCK_OVER",
                    title=rule["title_template"].format(name=listing.title[:20], stock=stock),
                    description=rule["desc_template"].format(
                        name=listing.title[:20], stock=stock, monthly_sales=monthly_sales,
                    ),
                    severity=rule["severity"],
                    confidence=0.75,
                    category=rule["type"],
                    related_entity_type="listing",
                    related_entity_id=listing.id,
                    source_refs=[{"type": "listing", "id": listing.id, "field": "performance.orders_30d"}],
                    evidence_window="近30天 Listing 订单表现",
                    confidence_reason="库存大于200且近30天销量小于10，命中库存积压规则",
                    metrics_before={"stock": stock, "monthly_sales": monthly_sales, "orders_30d": orders_30d},
                ))

        return suggestions
