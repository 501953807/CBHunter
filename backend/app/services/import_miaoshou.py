"""Import data from 妙手ERP exports into the system.

The importer requires an existing platform account accessible to the user. It
never creates a shop account or infers successful business states from missing fields.
"""

import os
import logging
import re
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.product import Product
from app.models.platform_account import PlatformAccount
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.category import Category
from app.services.category_seed import seed_categories
from app.services.store_access_service import can_access_store

logger = logging.getLogger(__name__)

# Paths to exported data
PRODUCT_CSV = os.environ.get("MIAOSHOU_PRODUCT_CSV", "data/产品信息.csv")
ORDER_XLSX = os.environ.get("MIAOSHOU_ORDER_XLSX", "data/订单数据.xlsx")


def _load_pandas():
    """Load pandas only when import jobs run, not during API startup."""
    try:
        import pandas as pd
    except ImportError as exc:
        raise RuntimeError("妙手导入需要 pandas，请先完成后端依赖安装") from exc
    return pd


def extract_1688_id(url: str) -> Optional[str]:
    """Extract 1688 offer ID from URL."""
    if not url:
        return None
    m = re.search(r'offer/(\d+)', url)
    if m:
        return m.group(1)
    m = re.search(r'goods_id=(\d+)', url)  # Pinduoduo
    if m:
        return f"pdd_{m.group(1)}"
    return None


def map_category(category_path: str) -> Optional[str]:
    """Map Shopee category path to system category name."""
    path_lower = category_path.lower()
    if 'crossbody' in path_lower or 'shoulder' in path_lower:
        return '斜挎包' if 'women' in path_lower else '斜挎包'
    if 'tote' in path_lower:
        return '托特包'
    if 'backpack' in path_lower:
        return '双肩包'
    if 'wallet' in path_lower or 'coin' in path_lower or 'purse' in path_lower:
        return '钱包/卡包'
    if 'waist' in path_lower or 'chest' in path_lower:
        return '斜挎包'
    if 'clutch' in path_lower or 'wristlet' in path_lower:
        return '手拿包'
    if 'top-handle' in path_lower:
        return '托特包'
    if 'jewelry' in path_lower or 'organizer' in path_lower:
        return '首饰收纳'
    if 'makeup' in path_lower or 'cosmetic' in path_lower:
        return '化妆包'
    if 'travel' in path_lower or 'duffel' in path_lower:
        return '托特包'
    if 'laptop' in path_lower:
        return '双肩包'
    if 'briefcase' in path_lower:
        return '托特包'
    return None


async def ensure_categories(db: AsyncSession):
    """Ensure categories are seeded."""
    result = await db.execute(select(Category).limit(1))
    if not result.scalar_one_or_none():
        await seed_categories(db)


async def find_category(db: AsyncSession, name: str) -> Optional[Category]:
    """Find a category by name."""
    result = await db.execute(
        select(Category).where(Category.name == name)
    )
    return result.scalar_one_or_none()


async def get_platform_account_for_import(
    db: AsyncSession, user_id: str, account_id: str
) -> PlatformAccount:
    """Return an import target account accessible to the user."""
    from app.models.user import User

    user = await db.get(User, user_id)
    if not user or not await can_access_store(db, user, account_id):
        raise ValueError("导入目标平台账号不存在或未授权")
    account = await db.get(PlatformAccount, account_id)
    if not account:
        raise ValueError("导入目标平台账号不存在或未授权")
    return account


def _optional_float(value, pd) -> Optional[float]:
    try:
        return float(value) if pd.notna(value) else None
    except (ValueError, TypeError) as exc:
        logger.debug("Invalid numeric value in Miaoshou import %r: %s", value, exc)
        return None


def _clean_text(value, pd) -> Optional[str]:
    if value is None or not pd.notna(value):
        return None
    text = str(value).strip()
    return text if text and text.lower() != "nan" else None


def map_order_status(raw_status: str) -> str:
    status = raw_status.lower()
    if "取消" in status or "cancel" in status:
        return "cancelled"
    if "退款" in status or "refund" in status:
        return "refunded"
    if "完成" in status or "签收" in status or "delivered" in status or "complete" in status:
        return "delivered"
    if "发货" in status or "运输" in status or "shipped" in status:
        return "shipped"
    if "处理" in status or "processing" in status:
        return "processing"
    return "pending"


async def import_products(db: AsyncSession, user_id: str, account_id: str) -> dict:
    """Import products from CSV."""
    await ensure_categories(db)

    pd = _load_pandas()
    df = pd.read_csv(PRODUCT_CSV, encoding='utf-8')
    logger.info(f"Read {len(df)} SKU rows from CSV")

    # Deduplicate by product_id, keep first
    products_df = df.groupby('产品ID').first().reset_index()

    created = 0
    skipped = 0
    invalid = 0
    for _, row in products_df.iterrows():
        product_id = _clean_text(row.get("产品ID"), pd)
        name = _clean_text(row.get("产品名称"), pd)
        if not product_id or not name:
            invalid += 1
            logger.warning("Skip product import row with missing product ID or name")
            continue

        # Check if product already exists by platform product ID
        existing = await db.execute(
            select(Product).where(
                Product.user_id == user_id,
                Product.attributes.contains({"platform_product_id": product_id})
            )
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        category_path = str(row.get('产品分类', ''))
        cat_name = map_category(category_path)
        category = await find_category(db, cat_name) if cat_name else None

        # Extract source price from 1688 link
        source_price = None
        source_url = str(row.get('关联货源链接', ''))
        if source_url and source_url != 'nan' and '1688.com' in source_url:
            source_price = _optional_float(row.get('关联货源价格'), pd)

        weight = _optional_float(row.get('包裹重量'), pd)
        weight_g = weight * 1000 if weight is not None else None
        brand = _clean_text(row.get("品牌"), pd)

        # Create product
        product = Product(
            user_id=user_id,
            sku=f"MIAOSHOU-{account_id[:8]}-{product_id}",
            name=name[:500],
            brand=brand,
            category_id=category.id if category else None,
            cost_price=source_price,
            weight_g=weight_g,
            status="draft",
            attributes={
                "platform_product_id": product_id,
                "platform_account_id": account_id,
                "shopee_category": category_path,
                "source_url": source_url if source_url != 'nan' else None,
                "source_platform": "1688" if '1688.com' in source_url else "pdd" if 'yangkeduo' in source_url else None,
            },
            tags=[cat_name] if cat_name else [],
        )
        db.add(product)
        created += 1

        # Flush every 50 products
        if created % 50 == 0:
            await db.flush()

    await db.commit()
    logger.info("Products imported: %s created, %s skipped, %s invalid", created, skipped, invalid)
    return {"created": created, "skipped": skipped, "invalid": invalid, "total_in_file": len(products_df)}


async def import_orders(db: AsyncSession, user_id: str, account_id: str) -> dict:
    """Import orders from Excel."""
    pd = _load_pandas()
    df = pd.read_excel(ORDER_XLSX)
    logger.info(f"Read {len(df)} order rows from Excel")

    for col in ['利润(RMB)', '订单总金额(RMB)', '产品单价(RMB)', '实付金额(RMB)',
                '佣金(RMB)', '手续费(RMB)', '运费总额(RMB)', '产品总价(RMB)',
                '平台回款金额(RMB)', '买家运费(RMB)', '商家运费(RMB)', '优惠金额(RMB)',
                '服务费(RMB)', '税费(RMB)']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    created = 0
    skipped = 0
    invalid = 0

    # Group order items by order_number
    for order_number, group in df.groupby('订单编号'):
        first_row = group.iloc[0]

        # Check if order exists
        existing = await db.execute(
            select(Order).where(
                Order.platform_account_id == account_id,
                Order.platform_order_id == str(order_number),
            )
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        # Parse order time
        try:
            order_time = pd.to_datetime(first_row['下单时间'])
        except (ValueError, TypeError, KeyError) as exc:
            invalid += 1
            logger.warning("Skip order %s with invalid order time: %s", order_number, exc)
            continue
        if pd.isna(order_time):
            invalid += 1
            logger.warning("Skip order %s with missing order time", order_number)
            continue

        total_rmb = _optional_float(first_row.get('订单总金额(RMB)'), pd)
        if total_rmb is None:
            invalid += 1
            logger.warning("Skip order %s with missing RMB total", order_number)
            continue
        commission_rmb = _optional_float(first_row.get('佣金(RMB)'), pd)
        fee_rmb = _optional_float(first_row.get('手续费(RMB)'), pd)
        service_rmb = _optional_float(first_row.get('服务费(RMB)'), pd)
        fee_parts = [commission_rmb, fee_rmb, service_rmb]
        platform_fee_total = sum(value or 0 for value in fee_parts) if any(value is not None for value in fee_parts) else None
        raw_status = _clean_text(first_row.get('订单状态'), pd) or ""
        order_status = map_order_status(raw_status)

        # Create order
        order = Order(
            user_id=user_id,
            platform_account_id=account_id,
            platform_order_id=str(order_number),
            order_number=str(order_number),
            status=order_status,
            total=total_rmb,
            shipping_fee=_optional_float(first_row.get('商家运费(RMB)'), pd),
            subtotal=None,
            platform_fee=platform_fee_total,
            discount=_optional_float(first_row.get('优惠金额(RMB)'), pd),
            currency='CNY',
            payment_status=None,
            fulfillment_status=order_status if order_status in ("shipped", "delivered") else None,
            ordered_at=order_time,
            platform_data={"source": "miaoshou_import", "source_order_status": raw_status},
        )
        db.add(order)
        await db.flush()

        # Create order items
        item_count = 0
        for _, item_row in group.iterrows():
            # Find product by platform_product_id
            product = None
            product_id_val = str(item_row.get('产品ID', ''))
            if product_id_val and product_id_val != 'nan':
                result = await db.execute(
                    select(Product).where(
                        Product.user_id == user_id,
                        Product.attributes.contains({"platform_product_id": product_id_val})
                    )
                )
                product = result.scalar_one_or_none()

            item_name = _clean_text(item_row.get('标题'), pd) or _clean_text(item_row.get('商品名称'), pd)
            if not item_name and product:
                item_name = product.name
            unit_price = _optional_float(item_row.get('产品单价(RMB)'), pd)
            quantity_value = _optional_float(item_row.get('产品数量'), pd)
            if (
                not item_name
                or unit_price is None
                or quantity_value is None
                or quantity_value <= 0
                or not quantity_value.is_integer()
            ):
                logger.warning("Skip invalid item in order %s", order_number)
                continue
            quantity = int(quantity_value)

            order_item = OrderItem(
                order_id=order.id,
                product_id=product.id if product else None,
                name=item_name[:500],
                quantity=quantity,
                unit_price=unit_price,
                total_price=unit_price * quantity,
                variation_info={"spec": str(item_row.get('产品规格(原文)', '')), "sku_id": str(item_row.get('SKU ID', ''))} if pd.notna(item_row.get('产品规格(原文)', '')) else None,
                platform_data={
                    "platform_sku": str(item_row.get('平台SKU', '')),
                    "sku_name": str(item_row.get('产品规格(中文)', '')),
                },
            )
            db.add(order_item)
            item_count += 1

        if item_count == 0:
            await db.delete(order)
            invalid += 1
            logger.warning("Skip order %s because it has no valid items", order_number)
            continue

        created += 1
        if created % 50 == 0:
            await db.flush()

    await db.commit()
    logger.info("Orders imported: %s created, %s skipped, %s invalid", created, skipped, invalid)
    return {"created": created, "skipped": skipped, "invalid": invalid, "total_in_file": len(df.groupby('订单编号'))}


async def import_miaoshou_data(db: AsyncSession, user_id: str, account_id: str) -> dict:
    """Import Miaoshou exports into an existing platform account."""
    account = await get_platform_account_for_import(db, user_id, account_id)
    logger.info("Starting Miaoshou import for account %s", account.id)

    product_result = await import_products(db, user_id, account.id)
    order_result = await import_orders(db, user_id, account.id)

    summary = {
        "platform_account": {"id": account.id, "name": account.account_name},
        "products": product_result,
        "orders": order_result,
    }
    logger.info(f"Import complete: {summary}")
    return summary
