from sqlalchemy import select
from app.models.product import Product
from app.models.platform_listing import PlatformListing
from app.models.platform_account import PlatformAccount
from app.ai.analyzers.base import BaseAnalyzer, Suggestion
from app.ai.rules import get_rule


class CrossPlatformAnalyzer(BaseAnalyzer):
    async def analyze(self, user_id: str) -> list[Suggestion]:
        suggestions = []

        # Get user's platforms
        result = await self.db.execute(
            select(PlatformAccount).where(
                PlatformAccount.user_id == user_id,
                PlatformAccount.is_active == True,
            )
        )
        accounts = list(result.scalars().all())
        platform_set = {a.platform for a in accounts}

        if len(platform_set) < 2:
            return suggestions

        # Get products with listings
        result = await self.db.execute(
            select(Product).where(Product.user_id == user_id, Product.status == "active")
        )
        products = list(result.scalars().all())

        for product in products:
            listing_result = await self.db.execute(
                select(PlatformAccount.platform)
                .join(PlatformListing, PlatformListing.platform_account_id == PlatformAccount.id)
                .where(PlatformListing.product_id == product.id)
            )
            listed_platforms = set(listing_result.scalars().all())

            missing_platforms = platform_set - listed_platforms
            for missing in missing_platforms:
                rule = get_rule("CROSS_GAP")
                from_p = next(iter(platform_set - {missing}), "已有平台")
                suggestions.append(Suggestion(
                    suggestion_type="CROSS_GAP",
                    title=rule["title_template"].format(
                        name=product.name[:20], from_platform=from_p, to_platform=missing,
                    ),
                    description=rule["desc_template"].format(
                        name=product.name[:20], from_platform=from_p,
                        to_platform=missing,
                    ),
                    severity="info",
                    confidence=0.5,
                    category="cross_platform",
                    related_entity_type="product",
                    related_entity_id=product.id,
                    source_refs=[
                        {"type": "product", "id": product.id},
                        {"type": "platform_accounts", "platforms": sorted(platform_set)},
                        {"type": "platform_listings", "platforms": sorted(listed_platforms)},
                    ],
                    evidence_window="当前平台账号和 Listing 覆盖快照",
                    confidence_reason=f"已绑定 {len(platform_set)} 个平台，商品缺少 {missing} 覆盖",
                ))

        return suggestions[:5]  # Limit to 5 suggestions
