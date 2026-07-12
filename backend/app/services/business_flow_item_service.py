"""Item-level projections for the V2 business-flow queue."""

from typing import Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_suggestion import AISuggestion
from app.models.order import Order
from app.models.platform_listing import PlatformListing
from app.models.product import Product
from app.models.product_discovery import ProductDiscovery
from app.models.sourcing_item import SourcingItem
from app.models.supply_product import SupplyProduct
from app.services.business_work_item_service import enrich_work_item_state
from app.services.evidence_service import source_ref
from app.services.store_access_service import list_accessible_store_ids_for_user_id

STAGE_NAMES = {
    "selection": "选品",
    "sourcing": "供应链/采购",
    "content": "标题与素材",
    "listing": "平台上架",
    "fulfillment": "订单履约",
    "optimization": "运营优化",
}


async def get_flow_items(db: AsyncSession, user_id: str) -> list[dict]:
    rows = []
    store_ids = await list_accessible_store_ids_for_user_id(db, user_id)
    discoveries = await db.execute(
        select(ProductDiscovery).where(ProductDiscovery.user_id == user_id)
        .order_by(desc(ProductDiscovery.updated_at)).limit(8)
    )
    rows.extend(_discovery_item(item) for item in discoveries.scalars().all())

    sourcing = await db.execute(
        select(SourcingItem)
        .where(SourcingItem.user_id == user_id, SourcingItem.is_active == True)  # noqa: E712
        .order_by(desc(SourcingItem.updated_at)).limit(8)
    )
    rows.extend(_sourcing_item(item) for item in sourcing.scalars().all())

    supplies = await db.execute(
        select(SupplyProduct)
        .where(SupplyProduct.user_id == user_id, SupplyProduct.is_active == True)  # noqa: E712
        .order_by(desc(SupplyProduct.last_updated)).limit(8)
    )
    rows.extend(_supply_item(item) for item in supplies.scalars().all())

    listings = await db.execute(
        select(PlatformListing, Product)
        .join(Product, Product.id == PlatformListing.product_id)
        .where(PlatformListing.platform_account_id.in_(store_ids))
        .order_by(desc(PlatformListing.updated_at)).limit(8)
    )
    rows.extend(_listing_item(item, product) for item, product in listings.all())

    orders = await db.execute(
        select(Order).where(Order.platform_account_id.in_(store_ids))
        .order_by(desc(Order.ordered_at)).limit(8)
    )
    rows.extend(_order_item(item) for item in orders.scalars().all())

    suggestions = await db.execute(
        select(AISuggestion)
        .where(
            AISuggestion.user_id == user_id,
            AISuggestion.is_applied == False,  # noqa: E712
            AISuggestion.is_dismissed == False,  # noqa: E712
        )
        .order_by(desc(AISuggestion.updated_at)).limit(8)
    )
    rows.extend(_ai_item(item) for item in suggestions.scalars().all())
    return rows[:30]


def _discovery_item(item: ProductDiscovery) -> dict:
    stage_key = "selection" if item.status not in ("sourcing", "listed") else item.status
    if stage_key == "listed":
        stage_key = "listing"
    gaps = []
    if item.trend_score is None:
        gaps.append("缺少真实趋势评分")
    if item.sourcing_price_rmb is None:
        gaps.append("缺少真实货源采购价")
    if not item.decision:
        gaps.append("缺少选品决策")
    return _item_payload(
        item.id, "product_discovery", item.product_name or "未命名选品", stage_key,
        "/scout", "选品列表",
        _join_existing([
            f"状态 {item.status}",
            f"决策 {item.decision}" if item.decision else None,
            f"趋势 {item.trend_score}" if item.trend_score is not None else None,
        ]),
        "进入选品列表继续验证" if gaps else "推进到品源匹配",
        gaps, [source_ref("product_discovery", item.id, label=item.product_name, meta={"route": "/scout"})], None, item.market,
    )


def _sourcing_item(item: SourcingItem) -> dict:
    stage_key = _sourcing_stage(item.pipeline_stage)
    gaps = []
    if item.source_price_rmb is None:
        gaps.append("缺少真实采购价")
    if not item.source_url:
        gaps.append("缺少 1688 或货源链接")
    if stage_key == "listing" and not item.listing_url:
        gaps.append("缺少平台上架链接")
    return _item_payload(
        item.id, "sourcing_item", item.product_name, stage_key, "/scout/sources",
        "品源管理 / 供应链采购",
        _join_existing([
            f"阶段 {item.pipeline_stage}",
            f"采购价 ¥{item.source_price_rmb}" if item.source_price_rmb is not None else None,
            f"利润率 {item.profit_margin_pct}%" if item.profit_margin_pct is not None else None,
        ]),
        "补齐货源与成本" if gaps else "推进到上架或运营",
        gaps, [source_ref("sourcing_item", item.id, label=item.product_name, meta={"route": "/scout/sources"})], item.platform, item.market,
        image_url=item.source_image, source_url=item.source_url,
    )


def _supply_item(item: SupplyProduct) -> dict:
    gaps = []
    if item.price_min is None and item.price_max is None:
        gaps.append("缺少真实 1688 价格")
    if not item.product_url:
        gaps.append("缺少 1688 商品链接")
    if not item.added_to_discovery:
        gaps.append("尚未加入选品流程")
    return _item_payload(
        item.id, "supply_product", item.name, "sourcing", "/scout/sources",
        "品源管理 / 供应商采集",
        _join_existing([
            item.shop_name,
            item.price_range_text,
            f"销量 {item.sales_volume}" if item.sales_volume is not None else None,
        ]),
        "进入品源管理复核" if gaps else "加入选品或采购流程",
        gaps, [source_ref("supply_product", item.id, label=item.name, meta={"route": "/scout/sources"})], item.platform, item.market,
        image_url=_first_image(item.images), source_url=item.product_url,
    )


def _listing_item(item: PlatformListing, product: Optional[Product] = None) -> dict:
    gaps = []
    if item.status in ("rejected", "blocked"):
        gaps.append(f"Listing状态为 {item.status}")
    if item.status == "active" and not item.listing_url:
        gaps.append("缺少平台上架链接")
    if not item.images:
        gaps.append("缺少上架图片")
    route = f"/products/{product.id}?tab=listings" if product else "/publish"
    payload = _item_payload(
        item.id, "platform_listing", item.title, "listing", route,
        "平台上架 / Listing",
        _join_existing([f"状态 {item.status}", f"库存 {item.stock}", f"价格 {item.price}"]),
        "进入批量刊登和平台校验" if gaps else "继续跟踪 Listing 表现",
        gaps, [source_ref("platform_listing", item.id, label=item.title, meta={"route": route})], None, None,
        image_url=_first_image(item.images) or _first_image(product.images if product else None),
        source_url=item.listing_url,
    )
    if product:
        payload["object_refs"] = [
            {"type": "platform_listing", "id": item.id, "label": item.title},
            {"type": "product", "id": product.id, "label": product.name},
        ]
    return payload


def _order_item(item: Order) -> dict:
    fulfillment = item.fulfillment_status or item.status
    gaps = []
    if fulfillment not in ("fulfilled", "shipped", "delivered", "completed", "done"):
        gaps.append(f"履约状态为 {fulfillment}")
    if item.payment_status and item.payment_status not in ("paid", "completed", "settled"):
        gaps.append(f"支付状态为 {item.payment_status}")
    return _item_payload(
        item.id, "order", item.order_number or item.platform_order_id, "fulfillment", "/orders",
        "订单管道",
        _join_existing([f"订单 {item.status}", f"履约 {fulfillment}", f"{item.currency} {item.total}"]),
        "处理订单履约与售后" if gaps else "进入运营复盘",
        gaps, [source_ref("order", item.id, label=item.order_number or item.platform_order_id, meta={"route": "/orders"})],
        item.platform_account.platform if item.platform_account else None, None,
    )


def _ai_item(item: AISuggestion) -> dict:
    gaps = []
    if item.severity == "critical":
        gaps.append("关键 AI 建议待人工复核")
    if item.confidence is None:
        gaps.append("缺少置信度")
    return _item_payload(
        item.id, "ai_suggestion", item.title, "optimization", "/ai-suggestions",
        "AI 运营建议",
        _join_existing([
            item.suggestion_type,
            f"严重度 {item.severity}",
            f"置信 {round(item.confidence * 100)}%" if item.confidence is not None else None,
        ]),
        "查看运营建议和增长机会" if gaps else "评估是否采纳建议",
        gaps, item.source_refs or [source_ref("ai_suggestion", item.id, label=item.title, meta={"route": "/ai-suggestions"})], None, None,
    )


def _item_payload(
    item_id: str,
    item_type: str,
    name: str,
    stage_key: str,
    route: str,
    source: str,
    signal: str,
    next_action: str,
    gaps: list[str],
    source_refs: list[dict],
    platform: Optional[str],
    market: Optional[str],
    image_url: Optional[str] = None,
    source_url: Optional[str] = None,
) -> dict:
    payload = {
        "id": item_id,
        "type": item_type,
        "name": name,
        "stage_key": stage_key,
        "stage_name": STAGE_NAMES.get(stage_key, stage_key),
        "status": _item_status(stage_key, gaps),
        "route": route,
        "next_action_route": route,
        "source": source,
        "signal": signal or source,
        "next_action": next_action,
        "data_gaps": gaps,
        "gaps": gaps,
        "source_refs": source_refs,
        "evidence_window": "当前数据库快照",
        "confidence_reason": f"基于 {source} 的 {item_type} 记录生成商品级业务节点。",
        "platform": platform,
        "market": market,
        "image_url": image_url,
        "source_url": source_url,
    }
    return enrich_work_item_state(payload)


def _first_image(images) -> Optional[str]:
    if isinstance(images, list) and images:
        return images[0]
    return None


def _sourcing_stage(pipeline_stage: str) -> str:
    if pipeline_stage in ("listed", "listing"):
        return "listing"
    if pipeline_stage in ("active", "vmi"):
        return "optimization"
    if pipeline_stage in ("jit_testing", "jit_passed"):
        return "fulfillment"
    return "sourcing"


def _item_status(stage_key: str, gaps: list[str]) -> str:
    if not gaps:
        return "ready"
    if stage_key in ("listing", "fulfillment", "optimization"):
        return "blocked"
    return "data_required"


def _join_existing(parts: list[Optional[str]]) -> str:
    return " · ".join([part for part in parts if part])
