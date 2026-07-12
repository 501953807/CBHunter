import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.models.product import Product
from app.models.platform_listing import PlatformListing
from app.schemas.product import ProductCreate, ProductUpdate
from app.services.store_access_service import list_accessible_store_ids_for_user_id

PRODUCT_TEST_NAME_PATTERNS = (
    "自动化测试",
    "仅名称无其他必填",
    "修改后的",
)


def generate_sku() -> str:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"OS-{today}-{uuid.uuid4().hex[:4].upper()}"


async def list_products(
    db: AsyncSession,
    user_id: str,
    status: Optional[str] = None,
    category_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
):
    query = select(Product).where(Product.user_id == user_id)

    if status:
        query = query.where(Product.status == status)
    if category_id:
        query = query.where(Product.category_id == category_id)
    if search:
        query = query.where(
            or_(
                Product.name.ilike(f"%{search}%"),
                Product.sku.ilike(f"%{search}%"),
            )
        )

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(Product.updated_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    products = list(result.scalars().all())

    return products, total


async def get_product(db: AsyncSession, product_id: str, user_id: str) -> Optional[Product]:
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def create_product(db: AsyncSession, user_id: str, req: ProductCreate):
    _assert_product_name_quality(req.name)
    sku = req.sku or generate_sku()

    # Ensure SKU uniqueness
    existing = await db.execute(
        select(Product).where(Product.sku == sku, Product.user_id == user_id)
    )
    if existing.scalar_one_or_none():
        sku = generate_sku()  # retry with new SKU

    product = Product(
        user_id=user_id,
        sku=sku,
        name=req.name,
        description=req.description,
        brand=req.brand,
        category_id=req.category_id,
        cost_price=req.cost_price,
        weight_g=req.weight_g,
        dimensions=req.dimensions or {},
        attributes=req.attributes or {},
        images=req.images or [],
        tags=req.tags or [],
        status=req.status,
        notes=req.notes,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


async def update_product(db: AsyncSession, product: Product, req: ProductUpdate):
    update_data = req.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] is not None:
        _assert_product_name_quality(update_data["name"])
    for field, value in update_data.items():
        setattr(product, field, value)
    await db.commit()
    await db.refresh(product)
    return product


async def delete_product(db: AsyncSession, product: Product):
    await db.delete(product)
    await db.commit()


async def batch_update_price(
    db: AsyncSession, user_id: str, product_ids: list[str], operation: str, value: float
):
    result = await db.execute(
        select(Product).where(
            Product.id.in_(product_ids), Product.user_id == user_id
        )
    )
    products = list(result.scalars().all())
    updated = []
    for p in products:
        if operation == "set":
            p.cost_price = value
        elif p.cost_price is None:
            continue
        elif operation == "increase":
            p.cost_price = p.cost_price + value
        elif operation == "decrease":
            p.cost_price = max(0, p.cost_price - value)
        elif operation == "markup":
            p.cost_price = p.cost_price * (1 + value / 100)
        updated.append(p)
    await db.commit()
    return updated


def validate_product_name_quality(name: str) -> None:
    if product_name_quality_flags(name):
        raise ValueError("商品名称疑似自动化测试残留，请填写真实商品名称")


def product_name_quality_flags(name: str) -> list[str]:
    normalized = str(name or "").strip()
    if normalized.endswith("-测试") or any(pattern in normalized for pattern in PRODUCT_TEST_NAME_PATTERNS):
        return ["test_residue"]
    return []


def _assert_product_name_quality(name: str) -> None:
    try:
        validate_product_name_quality(name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


async def batch_update_stock(
    db: AsyncSession, user_id: str, product_ids: list[str], operation: str, value: int
):
    """Batch update stock for products across all their platform listings.

    Operations: set, increase, decrease
    """
    store_ids = await list_accessible_store_ids_for_user_id(db, user_id)
    result = await db.execute(
        select(PlatformListing).where(
            PlatformListing.product_id.in_(product_ids),
            PlatformListing.platform_account_id.in_(store_ids),
        )
    )
    listings = list(result.scalars().all())
    updated = []
    for listing in listings:
        if operation == "set":
            listing.stock = max(0, value)
        elif operation == "increase":
            listing.stock = max(0, listing.stock + value)
        elif operation == "decrease":
            listing.stock = max(0, listing.stock - value)
        updated.append(listing)
    await db.commit()
    return updated
