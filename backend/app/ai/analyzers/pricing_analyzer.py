from sqlalchemy import select
from app.models.product import Product
from app.models.platform_listing import PlatformListing
from app.models.platform_account import PlatformAccount
from app.models.competitor_product import CompetitorProduct
from app.ai.analyzers.base import BaseAnalyzer, Suggestion
from app.ai.rules import get_rule


class PricingAnalyzer(BaseAnalyzer):
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
            if not platform:
                continue
            competitor_result = await self.db.execute(
                select(CompetitorProduct.price).where(
                    CompetitorProduct.user_id == user_id,
                    CompetitorProduct.platform == platform,
                    CompetitorProduct.price.is_not(None),
                )
            )
            competitor_prices = [float(price) for price in competitor_result.scalars().all() if price]
            if not competitor_prices:
                continue
            market_avg = sum(competitor_prices) / len(competitor_prices)

            if listing.price > market_avg * 1.5:
                rule = get_rule("PRICE_HIGH")
                over_pct = (listing.price / market_avg - 1) * 100
                suggestions.append(Suggestion(
                    suggestion_type="PRICE_HIGH",
                    title=rule["title_template"].format(name=listing.title[:20], price=listing.price, market_avg=market_avg),
                    description=rule["desc_template"].format(
                        name=listing.title[:20], price=listing.price,
                        market_avg=market_avg, over_pct=over_pct, suggested=market_avg * 1.1,
                    ),
                    severity=rule["severity"],
                    confidence=0.7,
                    category=rule["type"],
                    related_entity_type="listing",
                    related_entity_id=listing.id,
                    source_refs=[
                        {"type": "listing", "id": listing.id},
                        {"type": "competitor_prices", "platform": platform, "sample_count": len(competitor_prices)},
                    ],
                    evidence_window="当前竞品价格样本",
                    confidence_reason=f"基于 {len(competitor_prices)} 个竞品价格样本，当前售价高于均价 {over_pct:.0f}%",
                    metrics_before={"price": listing.price, "market_avg": market_avg, "sample_count": len(competitor_prices)},
                ))

        return suggestions
