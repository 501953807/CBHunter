"""Product analysis service: classification, ranking, and performance analysis."""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.product import Product
from app.models.order_item import OrderItem
from app.services.evidence_service import evidence_payload, source_ref


async def get_product_classification(db: AsyncSession, user_id: str) -> dict:
    """Classify all user's products into business roles."""
    # Get all products
    result = await db.execute(
        select(Product).where(Product.user_id == user_id, Product.status == 'active')
    )
    products = result.scalars().all()

    # Get order stats
    result = await db.execute(
        select(
            OrderItem.product_id,
            func.count(OrderItem.id).label('order_count'),
            func.sum(OrderItem.total_price).label('total_revenue'),
            func.max(OrderItem.id).label('last_order'),  # approximation
        )
        .where(OrderItem.product_id != None)
        .group_by(OrderItem.product_id)
    )
    order_stats = {}
    for row in result:
        order_stats[row.product_id] = {
            'orders': row.order_count or 0,
            'revenue': float(row.total_revenue or 0),
        }

    categories = {
        'core': [],    # >= 10 orders
        'profit': [],  # >= 3 orders
        'traffic': [], # >= 1 order
        'new': [],     # 0 orders, has cost
        'dead': [],    # Explicitly discontinued products only
        'data_missing': [],  # 0 orders, missing cost evidence
    }

    total_revenue = sum(s['revenue'] for s in order_stats.values())

    for p in products:
        stats = order_stats.get(p.id, {'orders': 0, 'revenue': 0})
        orders = stats['orders']
        revenue = stats['revenue']

        item = {
            'id': p.id,
            'name': p.name,
            'sku': p.sku,
            'orders': orders,
            'revenue': round(revenue, 2),
            'cost_price': p.cost_price,
            'status': p.status,
            'tags': p.tags or [],
        }

        if orders >= 10:
            categories['core'].append(item)
        elif orders >= 3:
            categories['profit'].append(item)
        elif orders >= 1:
            categories['traffic'].append(item)
        elif p.cost_price and p.cost_price > 0:
            categories['new'].append(item)
        else:
            categories['data_missing'].append(item)

    return {
        'total_products': len(products),
        'total_revenue': round(total_revenue, 2),
        'distribution': {
            'core': {'count': len(categories['core']), 'revenue_share': _share(categories['core'], total_revenue)},
            'profit': {'count': len(categories['profit']), 'revenue_share': _share(categories['profit'], total_revenue)},
            'traffic': {'count': len(categories['traffic']), 'revenue_share': _share(categories['traffic'], total_revenue)},
            'new': {'count': len(categories['new']), 'revenue_share': 0},
            'dead': {'count': len(categories['dead']), 'revenue_share': 0},
            'data_missing': {'count': len(categories['data_missing']), 'revenue_share': 0},
        },
        'core_products': categories['core'],
        'profit_products': categories['profit'],
        'new_product_count': len(categories['new']),
    }


async def rank_new_products(db: AsyncSession, user_id: str) -> list[dict]:
    """Rank unproven products by listing-data completeness.

    Sorts by: has images > has description > has cost_price > has weight > name length
    """
    result = await db.execute(
        select(Product).where(
            Product.user_id == user_id,
            Product.status == 'active',
        )
    )
    products = result.scalars().all()

    # Get products with orders to exclude
    result = await db.execute(
        select(OrderItem.product_id).where(OrderItem.product_id != None).distinct()
    )
    products_with_orders = set(r for r in result.scalars().all())

    # Score each new product
    scored = []
    for p in products:
        if p.id in products_with_orders:
            continue

        score = 0
        reasons = []

        # Has images
        images = p.images or []
        if len(images) > 0:
            score += 30
            reasons.append(f"有{len(images)}张图")

        # Has description
        if p.description:
            score += 20
            reasons.append("有描述")

        # Has cost_price (means they sourced it)
        if p.cost_price and p.cost_price > 0:
            score += 20
            reasons.append(f"采购价¥{p.cost_price}")

        # Has weight
        if p.weight_g and p.weight_g > 0:
            score += 10
            reasons.append(f"{p.weight_g:.0f}g")

        # Has 1688 source
        attrs = p.attributes or {}
        if attrs.get('source_url'):
            score += 10
            reasons.append("有货源链接")

        # Has brand
        if p.brand:
            score += 5
            reasons.append(f"品牌:{p.brand}")

        # Name length (longer = more complete listing)
        if len(p.name) > 50:
            score += 5

        scored.append({
            'id': p.id,
            'name': p.name,
            'sku': p.sku,
            'score': score,
            'cost_price': p.cost_price,
            'image_count': len(images),
            'has_description': bool(p.description),
            'has_source': bool(attrs.get('source_url')),
            'reasons': reasons,
            'action': '进入人工评估' if score >= 60 else '继续完善资料' if score >= 30 else '优先补齐资料',
        })

    scored.sort(key=lambda x: (-x['score'], x['name']))
    return scored


def _share(items: list, total: float) -> float:
    if total <= 0:
        return 0
    return round(sum(i['revenue'] for i in items) / total * 100, 1)


def classify_sourcing_items(items: list) -> dict:
    """Classify sourcing items without treating missing metrics as zero."""
    classes = ("core", "profit", "traffic", "new", "dead", "data_missing")
    grouped = {key: [] for key in classes}
    class_revenue = {key: 0.0 for key in classes}
    missing_metric_count = 0

    for item in items:
        sales = item.monthly_sales
        margin = item.profit_margin_pct
        selling_price = item.selling_price_local
        stage = item.pipeline_stage
        revenue = selling_price * sales if selling_price is not None and sales is not None else None

        if stage == "discontinued":
            classification = "dead"
        elif stage in ("discovery", "jit_testing", "jit_passed", "price_review", "vmi"):
            classification = "new"
        elif sales is None or margin is None or (sales > 0 and selling_price is None):
            classification = "data_missing"
            missing_metric_count += 1
        elif stage == "active" and margin >= 25 and sales > 0:
            classification = "core"
        elif margin >= 15 and sales > 0:
            classification = "profit"
        elif sales > 0:
            classification = "traffic"
        else:
            classification = "new"

        record = {
            "name": item.product_name,
            "orders": sales,
            "revenue": round(revenue, 2) if revenue is not None else None,
        }
        grouped[classification].append(record)
        if revenue is not None:
            class_revenue[classification] += revenue

    total_revenue = round(sum(class_revenue.values()), 2)
    distribution = {
        key: {
            "count": len(grouped[key]),
            "revenue_share": round(class_revenue[key] / total_revenue * 100, 1)
            if total_revenue > 0 else 0,
        }
        for key in classes
    }
    refs = [
        source_ref("sourcing_item", str(item.id), label=item.product_name)
        for item in items
        if getattr(item, "id", None)
    ]
    data_gaps = []
    if not items:
        data_gaps.append("尚无品源商品可用于健康度分类")
    if missing_metric_count:
        data_gaps.append(f"{missing_metric_count}个商品缺少销量、售价或利润率")
    return {
        "status": "ready" if items else "data_required",
        "total_products": len(items),
        "total_revenue": total_revenue,
        "revenue_status": "partial" if missing_metric_count else "complete",
        "missing_metric_count": missing_metric_count,
        "distribution": distribution,
        "core_products": grouped["core"][:5],
        **evidence_payload(
            source_refs=refs,
            evidence_window="当前品源商品最新录入值",
            confidence_reason="商品角色只依据已录入的阶段、月销量、售价和利润率分类；缺字段进入待补数据，不按零值补算。",
            data_gaps=data_gaps,
        ),
    }
