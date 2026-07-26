import math
import ipaddress
import socket
from typing import Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.platform_listing import PlatformListing
from app.models.platform_account import PlatformAccount
from app.schemas.product import (
    ProductCreate, ProductUpdate, ProductResponse, ProductListResponse,
    BatchPriceUpdate, BatchStockUpdate, BatchPublishRequest, ProductImageUrlImportRequest,
)
from app.schemas.common import ApiResponse
from app.services.product_service import (
    list_products,
    get_product,
    create_product,
    update_product,
    delete_product,
    batch_update_price,
    batch_update_stock,
    product_name_quality_flags,
)
from app.services.sample_product_service import seed_sample_products
from app.services.product_import_export_service import (
    build_product_csv,
    build_product_xlsx,
    export_products,
    import_products_from_upload,
)
from app.services.audit_service import record_audit_event
from app.services.evidence_service import source_ref
from app.services.sync_service import SyncService
from app.services.product_image_service import attach_product_image_from_url, attach_product_image_upload
from app.services.product_object_model_service import product_object_snapshot

router = APIRouter(prefix="/products", tags=["products"])
MAX_PROXY_IMAGE_BYTES = 10 * 1024 * 1024
BLOCKED_PROXY_NETWORKS = tuple(ipaddress.ip_network(cidr) for cidr in (
    "0.0.0.0/8",
    "10.0.0.0/8",
    "127.0.0.0/8",
    "169.254.0.0/16",
    "172.16.0.0/12",
    "192.168.0.0/16",
    "::1/128",
    "fc00::/7",
    "fe80::/10",
))


@router.get("", response_model=ApiResponse)
async def list_products_endpoint(
    status: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    products, total = await list_products(
        db, current_user.id, status, category_id, search, page, page_size
    )
    refs = [source_ref("product", item.id, label=item.sku, fields=["name", "status", "cost_price", "updated_at"]) for item in products]
    return ApiResponse(
        data=[_product_list_response(p) for p in products],
        meta={
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": math.ceil(total / page_size) if total > 0 else 0,
        },
        status="ready" if total else "data_required",
        source_refs=refs,
        evidence_window=f"当前筛选第 {page} 页",
        confidence_reason="结果直接读取当前用户商品主数据。",
        data_gaps=[] if total else ["暂无符合当前筛选条件的商品主数据"],
    )


@router.post("", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def create_product_endpoint(
    req: ProductCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    product = await create_product(db, current_user.id, req)
    await record_audit_event(
        db,
        user=current_user,
        action="create",
        resource_type="product",
        resource_id=product.id,
        new_value=_product_snapshot(product),
        detail="创建商品主数据",
    )
    gaps = []
    if product.category_id is None:
        gaps.append("缺少商品品类")
    if product.cost_price is None:
        gaps.append("缺少真实采购成本")
    if product.weight_g is None:
        gaps.append("缺少商品重量")
    if not product.images:
        gaps.append("缺少商品图片")
    return ApiResponse(
        data=_product_response(product),
        status="ready",
        source_refs=[source_ref("product", product.id, label=product.sku)],
        evidence_window="当前商品主数据快照",
        confidence_reason="字段直接来自当前用户商品记录；缺失字段保持为空。",
        data_gaps=gaps,
    )


@router.get("/export")
async def export_products_endpoint(
    format: str = Query("csv", pattern=r"^(csv|xlsx)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    products = await export_products(db, current_user.id)
    if format == "xlsx":
        content = build_product_xlsx(products)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "CBHunter-products.xlsx"
    else:
        content = build_product_csv(products)
        media_type = "text/csv; charset=utf-8"
        filename = "CBHunter-products.csv"
    await record_audit_event(
        db,
        user=current_user,
        action="product_export",
        resource_type="product",
        resource_id="export",
        new_value={"format": format, "count": len(products)},
        detail="导出商品主数据",
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import", response_model=ApiResponse)
async def import_products_endpoint(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    filename = file.filename or ""
    try:
        result = await import_products_from_upload(db, current_user.id, filename, await file.read())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await record_audit_event(
        db,
        user=current_user,
        action="product_import",
        resource_type="product",
        resource_id="import",
        new_value=result,
        detail="批量导入商品主数据",
    )
    return ApiResponse(
        data=result,
        status="ready" if result["created_count"] else "data_required",
        source_refs=[source_ref("product", item_id, fields=["sku", "name"]) for item_id in result["product_ids"]],
        evidence_window=f"导入文件 {filename}",
        confidence_reason="商品导入结果来自后端逐行解析并创建的真实商品记录。",
        data_gaps=[item["error"] for item in result["errors"]],
    )


@router.post("/sample-data", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def seed_sample_products_endpoint(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await seed_sample_products(db, current_user.id)
    linked_count = sum(result.get("created_counts", {}).values())
    product_ids = result["product_ids"] + result.get("skipped_product_ids", [])
    await record_audit_event(
        db,
        user=current_user,
        action="product_sample_seed",
        resource_type="product",
        resource_id="sample-data",
        new_value=result,
        detail="导入商品验证样本数据",
    )
    return ApiResponse(
        data=result,
        status="ready" if linked_count else "data_required",
        source_refs=[source_ref("product", item_id, fields=["sku", "name", "attributes"]) for item_id in product_ids],
        evidence_window="当前用户主动导入的验证样本商品",
        confidence_reason="样本数据写入真实业务表，仅用于验证业务链路，不作为空页面回退数据。",
        data_gaps=[] if linked_count else ["验证样本已存在，未重复创建"],
    )


@router.get("/platform-listings", response_model=ApiResponse)
async def list_platform_store_products_endpoint(
    platform: Optional[str] = Query(None),
    platform_account_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SyncService(db)
    items, total = await service.list_platform_store_products(
        current_user.id,
        platform=platform,
        platform_account_id=platform_account_id,
        status=status_filter,
        search=search,
        page=page,
        page_size=page_size,
    )
    return ApiResponse(
        data=items,
        meta={
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": math.ceil(total / page_size) if total else 0,
        },
        status="ready" if total else "data_required",
        source_refs=[
            source_ref("platform_listing", item["id"], label=item["title"], meta={"platform_account_id": item["store"]["id"]})
            for item in items
        ],
        evidence_window=f"当前筛选第 {page} 页平台店铺商品",
        confidence_reason="平台店铺商品库只读取真实 PlatformListing；同步回来的平台商品按店铺 Listing 实例归属，不合并为同一店铺商品。",
        data_gaps=[] if total else ["当前筛选下暂无平台店铺 Listing 实例；请先接入平台商品同步或创建本地 Listing 草稿"],
    )


@router.post("/{product_id}/images/upload", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def upload_product_image_endpoint(
    product_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await attach_product_image_upload(db, current_user.id, product_id, file)
    await record_audit_event(
        db,
        user=current_user,
        action="product_image_upload",
        resource_type="product",
        resource_id=product_id,
        new_value=result,
        detail="上传商品图片并写入商品图片列表",
    )
    return ApiResponse(
        data=result,
        status="ready",
        source_refs=[
            source_ref("product", product_id),
            source_ref("content_asset", result["asset"]["id"], label=result["asset"].get("original_name")),
        ],
        evidence_window="当前上传图片文件与生成素材",
        confidence_reason="商品图片来自用户上传的真实图片文件，系统只做尺寸标准化并写入商品图片列表。",
        data_gaps=[],
    )


@router.post("/{product_id}/images/import-url", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def import_product_image_url_endpoint(
    product_id: str,
    req: ProductImageUrlImportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await attach_product_image_from_url(db, current_user.id, product_id, req.image_url)
    await record_audit_event(
        db,
        user=current_user,
        action="product_image_import_url",
        resource_type="product",
        resource_id=product_id,
        new_value=result,
        detail="采集图片入库并写入商品图片列表",
    )
    return ApiResponse(
        data=result,
        status="ready",
        source_refs=[
            source_ref("product", product_id),
            source_ref("content_asset", result["asset"]["id"], label=result["asset"].get("original_name")),
            source_ref("source_image", req.image_url),
        ],
        evidence_window="当前图片 URL 与生成素材",
        confidence_reason="图片入库基于用户提供的真实 http/https 图片 URL，系统只做尺寸标准化并写入商品图片列表。",
        data_gaps=[],
    )


@router.get("/image-proxy")
async def proxy_product_image_endpoint(
    url: str = Query(..., min_length=8, max_length=2048),
    current_user: User = Depends(get_current_user),
):
    """Serve real external product images through the backend for display.

    Some 1688/CDN images used as product evidence block direct browser hotlinking.
    This endpoint does not generate or substitute images; it fetches the user-visible
    source image with browser-like headers and returns the original bytes.
    """
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=400, detail="仅支持 http/https 图片 URL")
    if _is_private_or_local_host(parsed.hostname or ""):
        raise HTTPException(status_code=400, detail="不允许代理本地或内网地址")

    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
            response = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
                "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                "Referer": f"{parsed.scheme}://{parsed.netloc}/",
            })
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="源图片读取失败") from exc
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"源图片不可访问：{response.status_code}")
    if len(response.content) > MAX_PROXY_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="源图片超过 10MB 展示限制")

    media_type = _image_media_type(url, response.headers.get("content-type", ""))
    return Response(
        content=response.content,
        media_type=media_type,
        headers={
            "Cache-Control": "public, max-age=86400",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/{product_id}/object-model", response_model=ApiResponse)
async def get_product_object_model_endpoint(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    snapshot = await product_object_snapshot(db, current_user.id, product_id)
    if snapshot.get("status") == "missing":
        raise HTTPException(status_code=404, detail="Product not found")
    return ApiResponse(
        data=snapshot,
        status="ready",
        source_refs=[source_ref("product", product_id, fields=["base_versions", "listing_instances", "sku_variants", "field_validations"])],
        evidence_window="当前商品 V5 对象模型快照",
        confidence_reason="读取 ProductBaseVersion、PlatformListing、ProductSkuVariant 和 PlatformFieldValidation 当前持久化记录。",
        data_gaps=snapshot.get("data_gaps", []),
    )


@router.get("/{product_id}", response_model=ApiResponse)
async def get_product_endpoint(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    product = await get_product(db, product_id, current_user.id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    response = _product_response(product)
    response.listings = await _product_listings(db, product.id, current_user.id)
    return ApiResponse(data=response)


@router.put("/{product_id}", response_model=ApiResponse)
async def update_product_endpoint(
    product_id: str,
    req: ProductUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    product = await get_product(db, product_id, current_user.id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    old_value = _product_snapshot(product)
    updated = await update_product(db, product, req)
    await record_audit_event(
        db,
        user=current_user,
        action="update",
        resource_type="product",
        resource_id=updated.id,
        old_value=old_value,
        new_value=_product_snapshot(updated),
        detail="更新商品主数据",
    )
    return ApiResponse(data=_product_response(updated))


@router.delete("/{product_id}", response_model=ApiResponse)
async def delete_product_endpoint(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    product = await get_product(db, product_id, current_user.id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    old_value = _product_snapshot(product)
    await delete_product(db, product)
    await record_audit_event(
        db,
        user=current_user,
        action="delete",
        resource_type="product",
        resource_id=product_id,
        old_value=old_value,
        detail="删除商品主数据",
    )
    return ApiResponse(data={"message": "Product deleted"})


@router.post("/batch/price", response_model=ApiResponse)
async def batch_price(
    req: BatchPriceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    updated = await batch_update_price(db, current_user.id, req.product_ids, req.operation, req.value)
    await record_audit_event(
        db,
        user=current_user,
        action="product_batch_price_update",
        resource_type="product",
        resource_id="batch",
        new_value={
            "product_ids": req.product_ids,
            "operation": req.operation,
            "value": req.value,
            "updated_count": len(updated),
        },
        detail="批量调整产品价格",
    )
    return ApiResponse(data={"updated_count": len(updated)})


@router.post("/batch/stock", response_model=ApiResponse)
async def batch_stock(
    req: BatchStockUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    updated = await batch_update_stock(db, current_user.id, req.product_ids, req.operation, req.value)
    await record_audit_event(
        db,
        user=current_user,
        action="product_batch_stock_update",
        resource_type="platform_listing",
        resource_id="batch",
        new_value={
            "product_ids": req.product_ids,
            "operation": req.operation,
            "value": req.value,
            "updated_count": len(updated),
        },
        detail="批量调整当前用户可访问店铺 Listing 库存",
    )
    return ApiResponse(
        data={"updated_count": len(updated)},
        status="ready" if updated else "data_required",
        source_refs=[
            source_ref("platform_listing", item.id, label=item.title, fields=["stock"])
            for item in updated
        ],
        evidence_window="当前用户可访问店铺 Listing 库存批量更新",
        confidence_reason="仅更新当前用户可访问店铺的 PlatformListing.stock，不写商品主档库存，也不修改其他店铺 Listing。",
        data_gaps=[] if updated else ["当前所选商品没有可访问店铺 Listing 可更新库存"],
    )


# ========== Product Analysis (Dashboard) ==========

@router.get("/analysis/classification", response_model=ApiResponse)
async def product_classification(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return product classification for dashboard (core/profit/traffic/new/dead)."""
    from app.models.sourcing_item import SourcingItem

    result = await db.execute(
        select(SourcingItem).where(SourcingItem.user_id == current_user.id)
    )
    from app.services.product_analysis import classify_sourcing_items
    return ApiResponse(data=classify_sourcing_items(list(result.scalars().all())))


def _is_private_or_local_host(hostname: str) -> bool:
    lowered = hostname.lower().strip("[]")
    if lowered in {"localhost", "0.0.0.0"} or lowered.endswith(".local"):
        return True
    try:
        addresses = socket.getaddrinfo(lowered, None)
    except socket.gaierror:
        return False
    for address in addresses:
        ip_text = address[4][0]
        try:
            ip = ipaddress.ip_address(ip_text)
        except ValueError:
            continue
        if any(ip in network for network in BLOCKED_PROXY_NETWORKS):
            return True
    return False


def _image_media_type(url: str, content_type: str) -> str:
    lowered = content_type.split(";")[0].strip().lower()
    if lowered.startswith("image/"):
        return lowered
    path = urlparse(url).path.lower()
    if ".webp" in path:
        return "image/webp"
    if ".png" in path:
        return "image/png"
    if ".gif" in path:
        return "image/gif"
    if ".svg" in path:
        return "image/svg+xml"
    return "image/jpeg"


def _product_snapshot(product) -> dict:
    return {
        "id": product.id,
        "sku": product.sku,
        "name": product.name,
        "brand": product.brand,
        "category_id": product.category_id,
        "cost_price": product.cost_price,
        "weight_g": product.weight_g,
        "dimensions": product.dimensions,
        "attributes": product.attributes,
        "images": product.images,
        "tags": product.tags,
        "status": product.status,
    }


def _product_list_response(product) -> ProductListResponse:
    response = ProductListResponse.model_validate(product)
    response.data_quality_flags = product_name_quality_flags(product.name)
    return response


def _product_response(product) -> ProductResponse:
    response = ProductResponse.model_validate(product)
    response.data_quality_flags = product_name_quality_flags(product.name)
    return response


async def _product_listings(db: AsyncSession, product_id: str, user_id: str) -> list[dict]:
    result = await db.execute(
        select(PlatformListing, PlatformAccount)
        .join(PlatformAccount, PlatformAccount.id == PlatformListing.platform_account_id)
        .where(PlatformListing.product_id == product_id, PlatformListing.user_id == user_id)
        .order_by(PlatformListing.updated_at.desc())
    )
    return [{
        "id": listing.id,
        "platform": account.platform,
        "account_name": account.account_name,
        "title": listing.title,
        "price": listing.price,
        "stock": listing.stock,
        "status": listing.status,
        "listing_url": listing.listing_url,
        "platform_data": listing.platform_data,
    } for listing, account in result.all()]
