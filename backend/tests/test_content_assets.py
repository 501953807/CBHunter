"""Tests for real content asset processing."""

import asyncio
import io

import pytest
from fastapi import HTTPException
from PIL import Image
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models import all_models  # noqa: F401
from app.services import content_asset_service
from app.services.content_asset_service import edit_image_from_url, process_image_bytes


def _image_bytes(width=400, height=200):
    output = io.BytesIO()
    Image.new("RGB", (width, height), (200, 30, 40)).save(output, format="PNG")
    return output.getvalue()


def test_image_edit_outputs_requested_real_dimensions():
    output, metadata = process_image_bytes(_image_bytes(), {
        "width": 1080,
        "height": 1080,
        "fit": "contain",
        "background": "#FFFFFF",
        "brightness": 1.1,
        "contrast": 1,
        "sharpness": 1,
        "output_format": "jpeg",
        "quality": 85,
    })

    image = Image.open(io.BytesIO(output))
    assert image.size == (1080, 1080)
    assert metadata["options"]["fit"] == "contain"
    assert len(output) > 0


def test_image_edit_rejects_unreadable_or_invalid_options():
    with pytest.raises(HTTPException):
        process_image_bytes(b"not-an-image", {"width": 1080, "height": 1080})

    with pytest.raises(HTTPException):
        process_image_bytes(_image_bytes(), {"width": 100, "height": 1080})


def test_image_edit_applies_crop_and_watermark_options():
    output, metadata = process_image_bytes(_image_bytes(600, 400), {
        "width": 800,
        "height": 800,
        "fit": "cover",
        "crop_mode": "manual",
        "crop_x": 100,
        "crop_y": 50,
        "crop_width": 300,
        "crop_height": 300,
        "watermark_text": "CBHunter",
        "watermark_position": "bottom_right",
        "watermark_opacity": 0.4,
        "watermark_color": "#FFFFFF",
        "output_format": "png",
    })

    image = Image.open(io.BytesIO(output))
    assert image.size == (800, 800)
    assert metadata["options"]["crop"] == {"mode": "manual", "x": 100, "y": 50, "width": 300, "height": 300}
    assert metadata["options"]["watermark"]["text"] == "CBHunter"
    assert metadata["options"]["watermark"]["position"] == "bottom_right"


def test_image_edit_from_source_url_persists_real_asset(tmp_path, monkeypatch):
    async def fake_fetch(url: str) -> tuple[bytes, str]:
        assert url == "https://cbu01.alicdn.com/img/ibank/real-product.webp"
        return _image_bytes(), "image/png"

    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'content-assets-url.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        monkeypatch.setattr(content_asset_service, "_fetch_source_image_bytes", fake_fetch)
        async with sessions() as session:
            asset = await edit_image_from_url(
                session,
                "content-user",
                "https://cbu01.alicdn.com/img/ibank/real-product.webp",
                {"width": 1080, "height": 1080, "output_format": "jpeg"},
                content_item_id="sourcing-item-1",
            )

        await engine.dispose()

        assert asset.asset_type == "image"
        assert asset.operation == "source_image_edit"
        assert asset.width == 1080
        assert asset.height == 1080
        assert asset.extra["source_url"] == "https://cbu01.alicdn.com/img/ibank/real-product.webp"
        assert asset.extra["content_item_id"] == "sourcing-item-1"

    asyncio.run(run_test())
