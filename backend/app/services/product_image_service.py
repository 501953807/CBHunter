"""Product image asset ingestion and binding helpers."""

from typing import Any

from fastapi import HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content_asset import ContentAsset
from app.services.content_asset_service import edit_image, edit_image_from_url
from app.services.product_service import get_product


def content_asset_file_url(asset_id: str) -> str:
    return f"/api/v1/content/assets/{asset_id}/file"


async def attach_product_image_upload(
    db: AsyncSession,
    user_id: str,
    product_id: str,
    upload: UploadFile,
) -> dict[str, Any]:
    product = await get_product(db, product_id, user_id)
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在或无权访问")
    asset = await edit_image(db, user_id, upload, _product_image_options())
    asset.operation = "product_image_upload"
    asset.extra = {
        **(asset.extra or {}),
        "product_id": product_id,
        "usage": "product_master_image",
        "asset_url": content_asset_file_url(asset.id),
    }
    image_url = await _append_asset_to_product(db, product, asset)
    return _product_image_payload(product_id, asset, image_url)


async def attach_product_image_from_url(
    db: AsyncSession,
    user_id: str,
    product_id: str,
    source_url: str,
) -> dict[str, Any]:
    product = await get_product(db, product_id, user_id)
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在或无权访问")
    asset = await edit_image_from_url(db, user_id, source_url, _product_image_options())
    asset.operation = "product_image_import_url"
    asset.extra = {
        **(asset.extra or {}),
        "product_id": product_id,
        "usage": "product_master_image",
        "asset_url": content_asset_file_url(asset.id),
        "source_url": source_url,
    }
    image_url = await _append_asset_to_product(db, product, asset)
    return _product_image_payload(product_id, asset, image_url)


async def _append_asset_to_product(db: AsyncSession, product, asset: ContentAsset) -> str:
    image_url = content_asset_file_url(asset.id)
    images = list(product.images or [])
    if image_url not in images:
        images.append(image_url)
    product.images = images
    await db.commit()
    await db.refresh(product)
    await db.refresh(asset)
    return image_url


def _product_image_payload(product_id: str, asset: ContentAsset, image_url: str) -> dict[str, Any]:
    return {
        "product_id": product_id,
        "image_url": image_url,
        "asset": {
            "id": asset.id,
            "asset_type": asset.asset_type,
            "original_name": asset.original_name,
            "mime_type": asset.mime_type,
            "size_bytes": asset.size_bytes,
            "width": asset.width,
            "height": asset.height,
            "operation": asset.operation,
            "status": asset.status,
            "extra": asset.extra or {},
        },
    }


def _product_image_options() -> dict[str, Any]:
    return {
        "width": 1200,
        "height": 1200,
        "fit": "contain",
        "background": "#FFFFFF",
        "brightness": 1,
        "contrast": 1,
        "sharpness": 1,
        "auto_contrast": False,
        "unsharp_mask": False,
        "output_format": "jpeg",
        "quality": 90,
    }
