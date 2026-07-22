"""Real image editing and slideshow-video rendering for the content factory."""

import asyncio
import io
import shutil
import tempfile
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse

from fastapi import HTTPException, UploadFile
import httpx
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps, UnidentifiedImageError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import gen_uuid
from app.models.content_asset import ContentAsset

ASSET_ROOT = Path(__file__).resolve().parents[2] / "data" / "content_assets"
MAX_FILE_BYTES = 10 * 1024 * 1024
IMAGE_FORMATS = {"jpeg": ("JPEG", "image/jpeg", ".jpg"), "png": ("PNG", "image/png", ".png"), "webp": ("WEBP", "image/webp", ".webp")}


async def edit_image(
    db: AsyncSession,
    user_id: str,
    upload: UploadFile,
    options: dict[str, Any],
) -> ContentAsset:
    content = await _read_upload(upload)
    output, metadata = process_image_bytes(content, options)
    output_format = options.get("output_format", "jpeg").lower()
    _, mime_type, suffix = IMAGE_FORMATS[output_format]
    asset_id = gen_uuid()
    stored_name = f"{asset_id}{suffix}"
    path = _asset_dir(user_id) / stored_name
    path.write_bytes(output)
    asset = ContentAsset(
        id=asset_id,
        user_id=user_id,
        asset_type="image",
        original_name=upload.filename,
        stored_name=stored_name,
        mime_type=mime_type,
        size_bytes=len(output),
        width=metadata["width"],
        height=metadata["height"],
        operation="image_edit",
        extra=metadata["options"],
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


async def edit_image_from_url(
    db: AsyncSession,
    user_id: str,
    source_url: str,
    options: dict[str, Any],
    content_item_id: str | None = None,
) -> ContentAsset:
    content, content_type = await _fetch_source_image_bytes(source_url)
    output, metadata = process_image_bytes(content, options)
    output_format = options.get("output_format", "jpeg").lower()
    _, mime_type, suffix = IMAGE_FORMATS[output_format]
    asset_id = gen_uuid()
    stored_name = f"{asset_id}{suffix}"
    path = _asset_dir(user_id) / stored_name
    path.write_bytes(output)
    asset = ContentAsset(
        id=asset_id,
        user_id=user_id,
        asset_type="image",
        original_name=Path(urlparse(source_url).path).name or "source-image",
        stored_name=stored_name,
        mime_type=mime_type,
        size_bytes=len(output),
        width=metadata["width"],
        height=metadata["height"],
        operation="source_image_edit",
        extra={
            **metadata["options"],
            "source_url": source_url,
            "source_content_type": content_type,
            "content_item_id": content_item_id,
        },
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


def process_image_bytes(content: bytes, options: dict[str, Any]) -> tuple[bytes, dict[str, Any]]:
    """Apply deterministic, merchant-selected edits without inventing image content."""
    width = _bounded_int(options.get("width"), "宽度", 320, 4096)
    height = _bounded_int(options.get("height"), "高度", 320, 4096)
    fit = options.get("fit", "contain")
    if fit not in {"contain", "cover"}:
        raise HTTPException(status_code=400, detail="适配方式仅支持 contain 或 cover")
    output_format = options.get("output_format", "jpeg").lower()
    if output_format not in IMAGE_FORMATS:
        raise HTTPException(status_code=400, detail="输出格式仅支持 jpeg、png 或 webp")

    try:
        source = Image.open(io.BytesIO(content))
        source.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(status_code=400, detail="无法识别上传的图片文件") from exc
    source = ImageOps.exif_transpose(source).convert("RGB")
    crop_box = _parse_crop_box(options, source.size)
    if crop_box:
        source = source.crop(crop_box)
    background = _parse_color(options.get("background", "#FFFFFF"))
    if fit == "cover":
        image = ImageOps.fit(source, (width, height), method=Image.Resampling.LANCZOS)
    else:
        image = ImageOps.contain(source, (width, height), method=Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (width, height), background)
        canvas.paste(image, ((width - image.width) // 2, (height - image.height) // 2))
        image = canvas

    brightness = _bounded_float(options.get("brightness", 1), "亮度", 0.5, 1.5)
    contrast = _bounded_float(options.get("contrast", 1), "对比度", 0.5, 1.5)
    sharpness = _bounded_float(options.get("sharpness", 1), "锐化", 0, 3)
    image = ImageEnhance.Brightness(image).enhance(brightness)
    image = ImageEnhance.Contrast(image).enhance(contrast)
    image = ImageEnhance.Sharpness(image).enhance(sharpness)
    if options.get("auto_contrast"):
        image = ImageOps.autocontrast(image)
    if options.get("unsharp_mask"):
        image = image.filter(ImageFilter.UnsharpMask(radius=2, percent=120, threshold=3))
    watermark = _parse_watermark(options)
    if watermark:
        _draw_watermark(image, watermark)

    output = io.BytesIO()
    pil_format = IMAGE_FORMATS[output_format][0]
    save_options: dict[str, Any] = {"optimize": True}
    if pil_format in {"JPEG", "WEBP"}:
        save_options["quality"] = _bounded_int(options.get("quality", 88), "质量", 40, 100)
    image.save(output, format=pil_format, **save_options)
    applied = {
        "width": width,
        "height": height,
        "fit": fit,
        "background": options.get("background", "#FFFFFF"),
        "brightness": brightness,
        "contrast": contrast,
        "sharpness": sharpness,
        "auto_contrast": bool(options.get("auto_contrast")),
        "unsharp_mask": bool(options.get("unsharp_mask")),
        "output_format": output_format,
        "quality": save_options.get("quality"),
        "crop": _crop_metadata(crop_box),
        "watermark": watermark,
    }
    return output.getvalue(), {"width": width, "height": height, "options": applied}


def _parse_crop_box(options: dict[str, Any], source_size: tuple[int, int]) -> tuple[int, int, int, int] | None:
    mode = str(options.get("crop_mode") or "none").lower()
    if mode == "none":
        return None
    if mode != "manual":
        raise HTTPException(status_code=400, detail="裁剪模式仅支持 none 或 manual")
    source_width, source_height = source_size
    x = _bounded_int(options.get("crop_x", 0), "裁剪X", 0, source_width - 1)
    y = _bounded_int(options.get("crop_y", 0), "裁剪Y", 0, source_height - 1)
    width = _bounded_int(options.get("crop_width", source_width - x), "裁剪宽度", 1, source_width)
    height = _bounded_int(options.get("crop_height", source_height - y), "裁剪高度", 1, source_height)
    right = min(source_width, x + width)
    bottom = min(source_height, y + height)
    if right <= x or bottom <= y:
        raise HTTPException(status_code=400, detail="裁剪区域无效")
    return (x, y, right, bottom)


def _crop_metadata(crop_box: tuple[int, int, int, int] | None) -> dict[str, int | str]:
    if not crop_box:
        return {"mode": "none"}
    left, top, right, bottom = crop_box
    return {"mode": "manual", "x": left, "y": top, "width": right - left, "height": bottom - top}


def _parse_watermark(options: dict[str, Any]) -> dict[str, Any] | None:
    text = str(options.get("watermark_text") or "").strip()
    if not text:
        return None
    if len(text) > 40:
        raise HTTPException(status_code=400, detail="水印文字不能超过 40 个字符")
    position = str(options.get("watermark_position") or "bottom_right").lower()
    if position not in {"top_left", "top_right", "bottom_left", "bottom_right", "center"}:
        raise HTTPException(status_code=400, detail="水印位置无效")
    opacity = _bounded_float(options.get("watermark_opacity", 0.32), "水印透明度", 0.05, 0.8)
    color = _parse_color(options.get("watermark_color", "#FFFFFF"))
    return {"text": text, "position": position, "opacity": opacity, "color": options.get("watermark_color", "#FFFFFF"), "rgb": color}


def _draw_watermark(image: Image.Image, watermark: dict[str, Any]) -> None:
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    text = watermark["text"]
    box = draw.textbbox((0, 0), text)
    text_width = box[2] - box[0]
    text_height = box[3] - box[1]
    padding = max(16, min(image.size) // 40)
    positions = {
        "top_left": (padding, padding),
        "top_right": (image.width - text_width - padding, padding),
        "bottom_left": (padding, image.height - text_height - padding),
        "bottom_right": (image.width - text_width - padding, image.height - text_height - padding),
        "center": ((image.width - text_width) // 2, (image.height - text_height) // 2),
    }
    rgb = watermark["rgb"]
    alpha = int(255 * watermark["opacity"])
    draw.text(positions[watermark["position"]], text, fill=(rgb[0], rgb[1], rgb[2], alpha))
    image.paste(Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB"))


async def render_slideshow_video(
    db: AsyncSession,
    user_id: str,
    uploads: list[UploadFile],
    options: dict[str, Any],
) -> ContentAsset:
    if not 1 <= len(uploads) <= 20:
        raise HTTPException(status_code=400, detail="视频素材图片数量必须为 1-20 张")
    if shutil.which("ffmpeg") is None:
        raise HTTPException(status_code=503, detail="当前环境未安装 ffmpeg，无法渲染视频")
    width = _bounded_int(options.get("width"), "宽度", 320, 2160)
    height = _bounded_int(options.get("height"), "高度", 320, 2160)
    seconds = _bounded_float(options.get("seconds_per_image", 2), "单图时长", 0.5, 10)
    asset_id = gen_uuid()
    stored_name = f"{asset_id}.mp4"
    output_path = _asset_dir(user_id) / stored_name

    with tempfile.TemporaryDirectory(prefix="cbhunter-video-") as temp_dir:
        temp_path = Path(temp_dir)
        manifest_lines = []
        for index, upload in enumerate(uploads):
            content = await _read_upload(upload)
            frame, _ = process_image_bytes(content, {
                "width": width,
                "height": height,
                "fit": options.get("fit", "contain"),
                "background": options.get("background", "#FFFFFF"),
                "output_format": "jpeg",
                "quality": 92,
            })
            frame_path = temp_path / f"frame-{index:03d}.jpg"
            frame_path.write_bytes(frame)
            manifest_lines.extend([f"file '{frame_path}'", f"duration {seconds}"])
        manifest_lines.append(f"file '{frame_path}'")
        manifest_path = temp_path / "frames.txt"
        manifest_path.write_text("\n".join(manifest_lines), encoding="utf-8")
        process = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(manifest_path),
            "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-movflags", "+faststart",
            str(output_path),
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await process.communicate()
        if process.returncode != 0:
            output_path.unlink(missing_ok=True)
            detail = stderr.decode("utf-8", errors="replace")[-500:]
            raise HTTPException(status_code=500, detail=f"视频渲染失败: {detail}")

    duration = round(len(uploads) * seconds, 2)
    asset = ContentAsset(
        id=asset_id,
        user_id=user_id,
        asset_type="video",
        original_name=None,
        stored_name=stored_name,
        mime_type="video/mp4",
        size_bytes=output_path.stat().st_size,
        width=width,
        height=height,
        duration_seconds=duration,
        operation="slideshow_render",
        extra={"image_count": len(uploads), "seconds_per_image": seconds, "fit": options.get("fit", "contain")},
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


async def list_assets(db: AsyncSession, user_id: str, page: int, page_size: int) -> tuple[list[ContentAsset], int]:
    condition = ContentAsset.user_id == user_id
    total = (await db.execute(select(func.count(ContentAsset.id)).where(condition))).scalar() or 0
    result = await db.execute(
        select(ContentAsset).where(condition).order_by(ContentAsset.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    return list(result.scalars().all()), total


async def get_asset(db: AsyncSession, user_id: str, asset_id: str) -> ContentAsset:
    result = await db.execute(select(ContentAsset).where(ContentAsset.id == asset_id, ContentAsset.user_id == user_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="素材不存在")
    return asset


async def delete_asset(db: AsyncSession, user_id: str, asset_id: str) -> None:
    asset = await get_asset(db, user_id, asset_id)
    _asset_path(asset).unlink(missing_ok=True)
    await db.delete(asset)
    await db.commit()


def asset_path(asset: ContentAsset) -> Path:
    path = _asset_path(asset)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="素材文件不存在")
    return path


async def _read_upload(upload: UploadFile) -> bytes:
    content = await upload.read(MAX_FILE_BYTES + 1)
    if not content:
        raise HTTPException(status_code=400, detail="上传文件为空")
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="单个素材文件不能超过 10 MB")
    return content


async def _fetch_source_image_bytes(source_url: str) -> tuple[bytes, str]:
    parsed = urlparse(source_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=400, detail="商品源图 URL 必须是 http/https")
    host = (parsed.hostname or "").lower()
    if host in {"localhost", "127.0.0.1", "::1"}:
        raise HTTPException(status_code=400, detail="不允许从本机地址读取素材")
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
            response = await client.get(source_url)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=400, detail="商品源图读取失败") from exc
    if response.status_code >= 400:
        raise HTTPException(status_code=400, detail=f"商品源图读取失败: HTTP {response.status_code}")
    content = response.content
    if not content:
        raise HTTPException(status_code=400, detail="商品源图为空")
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="商品源图不能超过 10 MB")
    content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
    if content_type and not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="商品源图 URL 返回的不是图片")
    return content, content_type or "image/unknown"


def _asset_dir(user_id: str) -> Path:
    path = ASSET_ROOT / user_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def _asset_path(asset: ContentAsset) -> Path:
    return _asset_dir(asset.user_id) / asset.stored_name


def _bounded_int(value: Any, label: str, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"{label}必须为整数") from exc
    if not minimum <= parsed <= maximum:
        raise HTTPException(status_code=400, detail=f"{label}必须在 {minimum}-{maximum} 之间")
    return parsed


def _bounded_float(value: Any, label: str, minimum: float, maximum: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"{label}必须为数字") from exc
    if not minimum <= parsed <= maximum:
        raise HTTPException(status_code=400, detail=f"{label}必须在 {minimum}-{maximum} 之间")
    return parsed


def _parse_color(value: Optional[str]) -> tuple[int, int, int]:
    named_colors = {"white": (255, 255, 255), "black": (0, 0, 0)}
    normalized = (value or "").strip().lower()
    if normalized in named_colors:
        return named_colors[normalized]
    color = normalized.lstrip("#")
    if len(color) != 6:
        raise HTTPException(status_code=400, detail="背景色必须为 6 位十六进制颜色")
    try:
        return tuple(int(color[index:index + 2], 16) for index in (0, 2, 4))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="背景色格式无效") from exc
