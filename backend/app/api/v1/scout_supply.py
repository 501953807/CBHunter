"""1688 supply product APIs under /scout."""

from datetime import datetime, timezone
from typing import Optional
import os
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.supply_product import SupplyProduct
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services.discovery_service import IMAGE_DIR, create_discovery, ensure_image_dir
from app.services.audit_service import record_audit_event

router = APIRouter(prefix="/scout", tags=["scout"])


@router.get("/supply-products", response_model=ApiResponse)
async def list_supply_products(
    keyword: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List 1688 supply chain products collected via extension."""
    query = select(SupplyProduct).where(
        SupplyProduct.user_id == current_user.id,
        SupplyProduct.is_active == True,
    ).order_by(SupplyProduct.discovered_at.desc())

    if keyword:
        query = query.where(
            or_(
                SupplyProduct.name.ilike(f"%{keyword}%"),
                SupplyProduct.category_path.ilike(f"%{keyword}%"),
                SupplyProduct.shop_name.ilike(f"%{keyword}%"),
            )
        )
    if category:
        query = query.where(SupplyProduct.category_path == category)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    result = await db.execute(query.offset((page - 1) * page_size).limit(page_size))
    products = result.scalars().all()

    items = []
    for product in products:
        items.append({
            "id": product.id,
            "platform": product.platform,
            "name": product.name,
            "sku": product.sku or "",
            "price_min": product.price_min,
            "price_max": product.price_max,
            "price_range_text": product.price_range_text or "",
            "shop_name": product.shop_name or "",
            "shop_url": product.shop_url or "",
            "supplier_rating": product.supplier_rating or "",
            "category_path": product.category_path or "",
            "market": product.market or "CN",
            "images": product.images or [],
            "product_url": product.product_url or "",
            "sales_volume": product.sales_volume,
            "moq": product.moq,
            "rating": product.rating,
            "tags": product.tags or [],
            "source": product.source or "browser_ext",
            "added_to_discovery": product.added_to_discovery or False,
            "discovery_id": product.discovery_id or "",
            "discovered_at": product.discovered_at.isoformat() if product.discovered_at else None,
            "last_updated": product.last_updated.isoformat() if product.last_updated else None,
        })

    return ApiResponse(data={"items": items, "total": total, "page": page, "page_size": page_size})


class AddSupplyToDiscoveryRequest(BaseModel):
    supply_product_id: str


@router.post("/supply-products/add-to-discovery", response_model=ApiResponse)
async def add_supply_to_discovery(
    req: AddSupplyToDiscoveryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a supply product's image to the image discovery pipeline."""
    result = await db.execute(
        select(SupplyProduct).where(
            SupplyProduct.id == req.supply_product_id,
            SupplyProduct.user_id == current_user.id,
        )
    )
    supply_product = result.scalar_one_or_none()
    if not supply_product:
        raise HTTPException(status_code=404, detail="Supply product not found")
    if supply_product.added_to_discovery and supply_product.discovery_id:
        raise HTTPException(status_code=400, detail="该产品已添加到图片选品")

    first_image_url = _get_first_image_url(supply_product)
    ensure_image_dir()
    filename = _build_image_filename(current_user.id, first_image_url)
    filepath = os.path.join(IMAGE_DIR, filename)
    await _download_image(first_image_url, filepath)

    discovery = await create_discovery(db, current_user.id, {
        "source_type": "image_upload",
        "source_image": filename,
        "source_url": supply_product.product_url or first_image_url,
        "category": supply_product.category_path or "",
        "product_name": supply_product.name,
        "notes": f"从供应链导入: {supply_product.name[:50]} (1688)",
        "tags": supply_product.tags or [],
    })

    supply_product.added_to_discovery = True
    supply_product.discovery_id = discovery.id
    supply_product.last_updated = datetime.now(timezone.utc)
    await db.commit()
    await record_audit_event(
        db,
        user=current_user,
        action="add_to_discovery",
        resource_type="supply_product",
        resource_id=supply_product.id,
        old_value={"added_to_discovery": False, "discovery_id": None},
        new_value=_supply_product_snapshot(supply_product),
        detail="将 1688 供应商品加入图片选品",
    )
    await record_audit_event(
        db,
        user=current_user,
        action="create",
        resource_type="product_discovery",
        resource_id=discovery.id,
        new_value={
            "id": discovery.id,
            "source_type": discovery.source_type,
            "source_image": discovery.source_image,
            "source_url": discovery.source_url,
            "product_name": discovery.product_name,
            "category": discovery.category,
            "notes": discovery.notes,
            "tags": discovery.tags,
        },
        detail="由 1688 供应商品生成图片选品记录",
    )

    return ApiResponse(data={
        "discovery_id": discovery.id,
        "supply_product_id": supply_product.id,
        "image_url": f"/api/v1/discovery/images/{filename}",
        "message": "已添加到图片选品，可前往「选品列表 → 图片选品」查看",
    })


@router.delete("/supply-products/{product_id}", response_model=ApiResponse)
async def delete_supply_product(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a supply product."""
    result = await db.execute(
        select(SupplyProduct).where(
            SupplyProduct.id == product_id,
            SupplyProduct.user_id == current_user.id,
        )
    )
    supply_product = result.scalar_one_or_none()
    if not supply_product:
        raise HTTPException(status_code=404, detail="Supply product not found")

    old_value = _supply_product_snapshot(supply_product)
    supply_product.is_active = False
    supply_product.last_updated = datetime.now(timezone.utc)
    await db.commit()
    await record_audit_event(
        db,
        user=current_user,
        action="delete",
        resource_type="supply_product",
        resource_id=supply_product.id,
        old_value=old_value,
        new_value=_supply_product_snapshot(supply_product),
        detail="软删除 1688 供应商品",
    )

    return ApiResponse(data={"message": "已删除"})


def _supply_product_snapshot(product: SupplyProduct) -> dict:
    return {
        "id": product.id,
        "platform": product.platform,
        "platform_product_id": product.platform_product_id,
        "name": product.name,
        "sku": product.sku,
        "category_path": product.category_path,
        "price_min": product.price_min,
        "price_max": product.price_max,
        "price_range_text": product.price_range_text,
        "shop_name": product.shop_name,
        "shop_url": product.shop_url,
        "supplier_rating": product.supplier_rating,
        "sales_volume": product.sales_volume,
        "moq": product.moq,
        "rating": product.rating,
        "product_url": product.product_url,
        "tags": product.tags,
        "market": product.market,
        "source": product.source,
        "is_active": product.is_active,
        "added_to_discovery": product.added_to_discovery,
        "discovery_id": product.discovery_id,
    }


def _get_first_image_url(supply_product: SupplyProduct) -> str:
    images = supply_product.images or []
    if not images:
        raise HTTPException(status_code=400, detail="该产品没有图片")
    first_image_url = images[0]
    if not first_image_url or not first_image_url.startswith("http"):
        raise HTTPException(status_code=400, detail="图片 URL 无效")
    return first_image_url


def _build_image_filename(user_id: str, image_url: str) -> str:
    ext = ".jpg"
    allowed_extensions = {".jpg", ".jpeg", ".png", ".webp"}
    if "?" in image_url:
        base = image_url.split("?")[0]
        _, ext_part = os.path.splitext(base)
        if ext_part.lower() in allowed_extensions:
            ext = ".jpg" if ext_part.lower() == ".jpeg" else ext_part.lower()
    return f"supply_{user_id[:8]}_{uuid.uuid4().hex[:8]}{ext}"


async def _download_image(image_url: str, filepath: str) -> None:
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(image_url)
            response.raise_for_status()
            if not (response.headers.get("content-type") or "").lower().startswith("image/"):
                raise ValueError("远程地址返回的不是图片")
            if len(response.content) > 10 * 1024 * 1024:
                raise ValueError("远程图片超过 10 MB")
            with open(filepath, "wb") as image_file:
                image_file.write(response.content)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"图片下载失败: {str(exc)}")
