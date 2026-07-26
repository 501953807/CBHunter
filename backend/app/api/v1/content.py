"""内容工厂 API — AI标题生成 + CSV上架导出."""

import csv
import io
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.common import PaginationMeta
from app.schemas.content import ContentAssetResponse
from app.api.v1.response_helpers import evidence_response
from app.services.content_service import generate_video_content_plan
from app.services.content_asset_service import (
    asset_path,
    delete_asset,
    edit_image,
    edit_image_from_url,
    get_asset,
    list_assets,
    render_slideshow_video,
)
from app.services.content_workbench_service import (
    CONTENT_TASKS,
    confirm_content_task_version,
    get_content_task_matrix,
    get_content_workbench,
    save_content_task_version,
)
from app.services.title_service import generate_titles
from app.services.evidence_service import configuration_required, data_required, evidence_payload, source_ref
from app.services.audit_service import record_audit_event
from app.services.ai_usage_audit_service import finalize_ai_task_result
from app.services.entitlement_service import require_and_consume_quota, require_entitlement
from app.services.system_config_service import get_gemini_key
from app.services.task_executor import TaskResult, execute_task

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/content", tags=["content"])


class ContentTaskVersionRequest(BaseModel):
    task_type: str
    content: str = Field(min_length=1)
    provider: str = "manual"


class ContentTaskConfirmRequest(BaseModel):
    task_type: str
    version: int = Field(ge=1)


class ContentTaskGenerateRequest(BaseModel):
    task_type: str
    product_name: str = ""
    category: str = ""
    platform: str = ""
    market: str = ""
    features: str = ""
    selling_points: str = ""
    target_audience: str = ""
    source_url: str = ""


@router.get("/workbench", response_model=ApiResponse)
async def get_content_factory_workbench(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workbench = await get_content_workbench(db, current_user.id)
    return ApiResponse(
        data=workbench,
        status=workbench["status"],
        source_refs=[
            ref
            for item in workbench["items"]
            for ref in item.get("source_refs", [])
        ],
        evidence_window=workbench["evidence_window"],
        confidence_reason=workbench["confidence_reason"],
        data_gaps=workbench["data_gaps"],
    )


@router.get("/workbench/{item_id}/tasks", response_model=ApiResponse)
async def get_content_factory_task_matrix(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    matrix = await get_content_task_matrix(db, current_user.id, item_id)
    return ApiResponse(
        data=matrix,
        status="ready",
        source_refs=matrix["source_refs"],
        evidence_window=matrix["evidence_window"],
        confidence_reason=matrix["confidence_reason"],
        data_gaps=[],
    )


@router.post("/workbench/{item_id}/tasks/versions", response_model=ApiResponse)
async def create_content_task_version(
    item_id: str,
    req: ContentTaskVersionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await save_content_task_version(
        db, current_user.id, item_id, req.task_type, req.content, provider=req.provider
    )
    await record_audit_event(
        db,
        user=current_user,
        action="create",
        resource_type="content_task_version",
        resource_id=f"{item_id}:{req.task_type}:{result['version']}",
        new_value=result,
        detail="保存内容任务候选版本",
    )
    return ApiResponse(data=result, status="ready")


@router.post("/workbench/{item_id}/tasks/confirm", response_model=ApiResponse)
async def confirm_content_task(
    item_id: str,
    req: ContentTaskConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    matrix = await confirm_content_task_version(db, current_user.id, item_id, req.task_type, req.version)
    await record_audit_event(
        db,
        user=current_user,
        action="confirm",
        resource_type="content_task_version",
        resource_id=f"{item_id}:{req.task_type}:{req.version}",
        new_value={"task_type": req.task_type, "version": req.version},
        detail="确认内容任务版本",
    )
    return ApiResponse(
        data=matrix,
        status="ready",
        source_refs=matrix["source_refs"],
        evidence_window=matrix["evidence_window"],
        confidence_reason=matrix["confidence_reason"],
        data_gaps=[],
    )


@router.post("/workbench/{item_id}/tasks/generate", response_model=ApiResponse)
async def generate_content_task_candidate(
    item_id: str,
    req: ContentTaskGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    allowed_tasks = {task["task_type"] for task in CONTENT_TASKS}
    if req.task_type not in allowed_tasks:
        raise HTTPException(status_code=400, detail="未知内容任务类型")
    if req.task_type in {"listing_copy", "video_script"}:
        raise HTTPException(status_code=400, detail="标题和视频请使用专项生成入口")

    await require_entitlement(db, current_user, "ai.tasks.monthly")
    result = await execute_task(db, req.task_type, {**req.model_dump(), "content_item_id": item_id})
    await _finalize_content_ai_task(db, current_user, req.task_type, result, item_id)
    if not result.success:
        missing = data_required(
            result.error or "内容任务生成失败。",
            data_gaps=["ai_generation_result"],
            evidence_window="当前内容任务输入",
            confidence_reason="AI/规则执行器未返回可用候选内容。",
            source_refs=[source_ref("sourcing_item", item_id)],
        )
        return ApiResponse(data={
            "status": missing["status"],
            "task_type": req.task_type,
            "task_version": None,
            "note": result.error or "内容任务生成失败。",
            **missing,
        }, status=missing["status"], source_refs=missing["source_refs"],
           evidence_window=missing["evidence_window"], confidence_reason=missing["confidence_reason"],
           data_gaps=missing["data_gaps"])

    candidate = _task_result_candidate_content(result)
    task_version = await _save_ai_task_candidate(db, current_user, item_id, req.task_type, candidate)
    evidence = evidence_payload(
        source_refs=[source_ref("sourcing_item", item_id), source_ref("ai_task", req.task_type)],
        evidence_window="当前内容任务输入",
        confidence_reason="AI 或规则后备仅生成候选内容，需人工确认后才能进入 Listing。",
        data_gaps=(result.data or {}).get("data_gaps") or [],
    )
    return ApiResponse(data={
        "status": "ready",
        "task_type": req.task_type,
        "content": candidate,
        "provider": result.provider,
        "confidence": result.confidence,
        "task_version": task_version,
        **evidence,
    }, status="ready", source_refs=evidence["source_refs"],
       evidence_window=evidence["evidence_window"], confidence_reason=evidence["confidence_reason"],
       data_gaps=evidence["data_gaps"])


def _image_edit_options(**values) -> dict:
    keys = {
        "width", "height", "fit", "background", "brightness", "contrast", "sharpness",
        "auto_contrast", "unsharp_mask", "crop_mode", "crop_x", "crop_y", "crop_width",
        "crop_height", "rotate_degrees", "flip_horizontal", "flip_vertical",
        "watermark_text", "watermark_position", "watermark_opacity", "watermark_color",
        "output_format", "quality", "content_item_id",
    }
    return {key: values[key] for key in keys if key in values}


@router.post("/assets/image-edit", response_model=ApiResponse, status_code=201)
async def create_edited_image(
    file: UploadFile = File(...),
    width: int = Form(1080),
    height: int = Form(1080),
    fit: str = Form("contain"),
    background: str = Form("#FFFFFF"),
    brightness: float = Form(1),
    contrast: float = Form(1),
    sharpness: float = Form(1),
    auto_contrast: bool = Form(False),
    unsharp_mask: bool = Form(False),
    crop_mode: str = Form("none"),
    crop_x: int = Form(0),
    crop_y: int = Form(0),
    crop_width: int = Form(1080),
    crop_height: int = Form(1080),
    rotate_degrees: int = Form(0),
    flip_horizontal: bool = Form(False),
    flip_vertical: bool = Form(False),
    watermark_text: str = Form(""),
    watermark_position: str = Form("bottom_right"),
    watermark_opacity: float = Form(0.32),
    watermark_color: str = Form("#FFFFFF"),
    output_format: str = Form("jpeg"),
    quality: int = Form(88),
    content_item_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset = await edit_image(db, current_user.id, file, _image_edit_options(**locals()))
    await record_audit_event(
        db,
        user=current_user,
        action="create",
        resource_type="content_asset",
        resource_id=asset.id,
        new_value=_asset_snapshot(asset),
        detail="生成图片处理素材",
    )
    return ApiResponse(data=ContentAssetResponse.model_validate(asset))


class SourceImageEditRequest(BaseModel):
    image_url: str
    content_item_id: Optional[str] = None
    width: int = 1080
    height: int = 1080
    fit: str = "contain"
    background: str = "#FFFFFF"
    brightness: float = 1
    contrast: float = 1
    sharpness: float = 1
    auto_contrast: bool = False
    unsharp_mask: bool = False
    crop_mode: str = "none"
    crop_x: int = 0
    crop_y: int = 0
    crop_width: int = 1080
    crop_height: int = 1080
    rotate_degrees: int = 0
    flip_horizontal: bool = False
    flip_vertical: bool = False
    watermark_text: str = ""
    watermark_position: str = "bottom_right"
    watermark_opacity: float = 0.32
    watermark_color: str = "#FFFFFF"
    output_format: str = "jpeg"
    quality: int = 88


@router.post("/assets/image-edit-url", response_model=ApiResponse, status_code=201)
async def create_edited_image_from_url(
    req: SourceImageEditRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset = await edit_image_from_url(db, current_user.id, req.image_url, _image_edit_options(**req.model_dump()), content_item_id=req.content_item_id)
    await record_audit_event(
        db,
        user=current_user,
        action="create",
        resource_type="content_asset",
        resource_id=asset.id,
        new_value=_asset_snapshot(asset),
        detail="使用商品源图生成图片处理素材",
    )
    return ApiResponse(
        data=ContentAssetResponse.model_validate(asset),
        status="ready",
        source_refs=[source_ref("content_asset", asset.id, label=asset.original_name), source_ref("source_image", req.image_url)],
        evidence_window="当前商品源图 URL 与处理参数",
        confidence_reason="图片处理基于用户选中商品的真实源图 URL，只做尺寸、裁剪、背景、亮度、对比度、锐化和水印等确定性处理，不生成虚构画面。",
        data_gaps=[],
    )


@router.post("/assets/video-render", response_model=ApiResponse, status_code=201)
async def create_slideshow_video(
    files: List[UploadFile] = File(...),
    width: int = Form(1080),
    height: int = Form(1920),
    fit: str = Form("contain"),
    background: str = Form("#FFFFFF"),
    seconds_per_image: float = Form(2),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset = await render_slideshow_video(db, current_user.id, files, {
        "width": width, "height": height, "fit": fit,
        "background": background, "seconds_per_image": seconds_per_image,
    })
    await record_audit_event(
        db,
        user=current_user,
        action="create",
        resource_type="content_asset",
        resource_id=asset.id,
        new_value=_asset_snapshot(asset),
        detail="生成商品短视频素材",
    )
    return ApiResponse(data=ContentAssetResponse.model_validate(asset))


@router.get("/assets", response_model=ApiResponse)
async def get_content_assets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    assets, total = await list_assets(db, current_user.id, page, page_size)
    return ApiResponse(
        data=[ContentAssetResponse.model_validate(asset) for asset in assets],
        meta=PaginationMeta(page=page, page_size=page_size, total=total, total_pages=(total + page_size - 1) // page_size),
        status="ready" if total else "data_required",
        source_refs=[source_ref("content_asset", asset.id, label=asset.original_name, fields=["asset_type", "operation", "status", "created_at"]) for asset in assets],
        evidence_window=f"当前素材库第 {page} 页",
        confidence_reason="列表仅包含当前用户已实际生成并持久化的素材。",
        data_gaps=[] if total else ["暂无已生成内容素材"],
    )


@router.get("/assets/{asset_id}/file")
async def download_content_asset(
    asset_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset = await get_asset(db, current_user.id, asset_id)
    return FileResponse(asset_path(asset), media_type=asset.mime_type, filename=asset.stored_name)


@router.delete("/assets/{asset_id}", response_model=ApiResponse)
async def remove_content_asset(
    asset_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset = await get_asset(db, current_user.id, asset_id)
    old_value = _asset_snapshot(asset)
    await delete_asset(db, current_user.id, asset_id)
    await record_audit_event(
        db,
        user=current_user,
        action="delete",
        resource_type="content_asset",
        resource_id=asset_id,
        old_value=old_value,
        detail="删除内容工厂素材",
    )
    return ApiResponse(data={"deleted": True, "id": asset_id})


class TitleGenRequest(BaseModel):
    product_name: str
    platform: str
    market: str
    content_item_id: Optional[str] = None
    features: str = ""
    material: str = ""
    scenes: str = ""
    target_audience: str = ""


class FiveStepTitleGenRequest(BaseModel):
    product_name: str
    platform: str
    market: str
    content_item_id: Optional[str] = None
    category: str = ""
    features: str = ""
    material: str = ""
    target_audience: str = ""
    scenes: str = ""


class VideoContentRequest(BaseModel):
    product_name: str
    platform: str
    market: str
    content_item_id: Optional[str] = None
    category: str = ""
    features: str = ""
    target_audience: str = ""
    selling_points: str = ""


class CSVExportItem(BaseModel):
    sku: str = Field(min_length=1)
    name: str = Field(min_length=1)
    price: float = Field(gt=0)
    stock: int = Field(ge=0)
    weight_g: int = Field(gt=0)
    description: str = ""
    category_id: str = ""
    brand: str = ""
    image_url: str = ""
    shipping_fee: Optional[float] = None
    package_size: str = ""
    product_status: str = ""
    seo_title: str = ""
    keywords: str = ""


class CSVExportRequest(BaseModel):
    items: list[CSVExportItem] = Field(default_factory=list)


@router.post("/generate-title", response_model=ApiResponse)
async def generate_title(
    req: TitleGenRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """用Gemini生成平台适配的SEO标题 (5个变体)."""
    await require_entitlement(db, current_user, "ai.tasks.monthly")
    api_key = await get_gemini_key(db)
    if not api_key:
        await _finalize_content_ai_task(
            db,
            current_user,
            "listing_copy",
            TaskResult(False, provider="gemini", error="gemini_api_key_missing"),
            req.content_item_id,
        )
        return evidence_response({
            "titles": [],
            "best_title": "",
            "note": "AI未配置，无法生成真实标题。请在设置中配置AI Provider。",
            **configuration_required(
                "AI未配置，无法生成真实标题。请在设置中配置AI Provider。",
                data_gaps=["system_config.gemini_api_key"],
                evidence_window="当前 AI 配置",
            ),
        })

    from google import genai
    prompt = f"""你是跨境电商平台标题优化专家。

根据以下产品信息，为{req.platform} {req.market}站生成5个标题：

产品名称：{req.product_name}
核心功能：{req.features}
材质：{req.material}
适用场景：{req.scenes}
目标用户：{req.target_audience}

要求：
1. 遵守 {req.platform} 当前标题规则；无法确认规则时使用自然、准确的通用标题
2. 结构：核心关键词 + 属性词 + 场景词
3. 不要全大写，不得虚构销量、价格、折扣、认证或功效
4. 每个标题占一行

输出格式：
title1
title2
title3
title4
title5
"""

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=[prompt],
        )
        titles = [t.strip() for t in (response.text or "").strip().split('\n') if t.strip()][:5]
        if not titles:
            await _finalize_content_ai_task(
                db,
                current_user,
                "listing_copy",
                TaskResult(True, {}, provider="gemini", confidence="medium"),
                req.content_item_id,
            )
            return evidence_response({
                "titles": [],
                "best_title": "",
                "note": "AI 未返回可用标题。",
                **data_required(
                    "AI 未返回可用标题。",
                    data_gaps=["ai_generation_result"],
                    evidence_window="当前请求输入",
                    confidence_reason="AI 未返回可用标题",
                ),
            })
        await _finalize_content_ai_task(
            db,
            current_user,
            "listing_copy",
            TaskResult(True, {"titles": titles, "best_title": titles[0]}, provider="gemini", confidence="high"),
            req.content_item_id,
        )
        task_version = await _save_ai_task_candidate(
            db,
            current_user,
            req.content_item_id,
            "listing_copy",
            _titles_candidate_content(titles),
        )
        return evidence_response({
            "titles": titles,
            "best_title": titles[0],
            "status": "ready",
            "task_version": task_version,
            **evidence_payload(
                source_refs=[source_ref("merchant_input", fields=[
                    key for key, value in req.model_dump().items() if value
                ])],
                evidence_window="当前请求输入",
                confidence_reason="标题由 AI 根据商家输入生成，未经真实曝光和转化数据验证",
            ),
        })
    except Exception as e:
        logger.error(f"Title generation failed: {e}")
        await _finalize_content_ai_task(
            db,
            current_user,
            "listing_copy",
            TaskResult(False, provider="gemini", error=str(e)),
            req.content_item_id,
        )
        return evidence_response({
            "titles": [],
            "best_title": "",
            "note": f"AI生成失败: {str(e)}",
            **data_required(
                f"AI生成失败: {str(e)}",
                data_gaps=["ai_generation_result"],
                evidence_window="当前请求输入",
            ),
        })


@router.post("/generate-titles", response_model=ApiResponse)
async def generate_titles_five_step(
    req: FiveStepTitleGenRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """五步法生成爆款标题 — 融合趋势热词+竞品高频词+平台规则."""
    await require_entitlement(db, current_user, "ai.tasks.monthly")
    result = await generate_titles(db, current_user.id, req.model_dump())
    if result.get("status") == "ready" or result.get("titles"):
        await _finalize_content_ai_task(
            db,
            current_user,
            "listing_copy",
            TaskResult(True, result, provider=result.get("provider", "title_service"), confidence="medium"),
            req.content_item_id,
        )
        task_version = await _save_ai_task_candidate(
            db,
            current_user,
            req.content_item_id,
            "listing_copy",
            _titles_candidate_content(result.get("titles") or []),
        )
        if task_version:
            result = {**result, "task_version": task_version}
    else:
        await _finalize_content_ai_task(
            db,
            current_user,
            "listing_copy",
            TaskResult(False, result, provider=result.get("provider", "title_service"), error=str(result.get("message") or result.get("note") or "")),
            req.content_item_id,
        )
    return evidence_response(result)


@router.post("/generate-video-plan", response_model=ApiResponse)
async def generate_video_plan(
    req: VideoContentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate product-specific short-video scripts, hashtags and 7-day plan."""
    await require_entitlement(db, current_user, "ai.tasks.monthly")
    result = await generate_video_content_plan(db, req.model_dump())
    if result.get("status") == "ready":
        await _finalize_content_ai_task(
            db,
            current_user,
            "video_script",
            TaskResult(True, result, provider=result.get("provider", "content_service"), confidence="medium"),
            req.content_item_id,
        )
        task_version = await _save_ai_task_candidate(
            db,
            current_user,
            req.content_item_id,
            "video_script",
            _video_plan_candidate_content(result),
        )
        if task_version:
            result = {**result, "task_version": task_version}
    else:
        await _finalize_content_ai_task(
            db,
            current_user,
            "video_script",
            TaskResult(False, result, provider=result.get("provider", "content_service"), error=str(result.get("message") or result.get("note") or "")),
            req.content_item_id,
        )
    return evidence_response(result)


@router.post("/export-csv")
async def export_shopee_csv(
    req: CSVExportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """生成Shopee批量上架CSV文件."""
    await require_entitlement(db, current_user, "exports.enabled")
    output = io.StringIO()
    writer = csv.writer(output)

    # Shopee批量上架CSV表头 (标准格式)
    writer.writerow([
        "SKU", "名称", "描述", "品类ID", "品牌",
        "价格", "库存", "重量(g)", "图片URL",
        "变体1名称", "变体1选项", "变体1价格", "变体1库存",
        "变体2名称", "变体2选项", "变体2价格", "变体2库存",
        "运费", "包裹尺寸(cm)", "商品状态",
        "SEO标题", "关键词",
    ])

    for item in req.items:
        writer.writerow([
            item.sku,
            item.name,
            item.description,
            item.category_id,
            item.brand,
            item.price,
            item.stock,
            item.weight_g,
            item.image_url,
            "", "", "", "",  # 变体(空)
            "", "", "", "",
            "" if item.shipping_fee is None else item.shipping_fee,
            item.package_size,
            item.product_status,
            item.seo_title,
            item.keywords,
        ])

    output.seek(0)
    await record_audit_event(
        db,
        user=current_user,
        action="content_shopee_csv_export",
        resource_type="listing_export",
        resource_id="shopee_csv",
        new_value={"item_count": len(req.items), "skus": [item.sku for item in req.items]},
        detail="导出 Shopee 批量上架 CSV",
    )
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=shopee_bulk_upload.csv"},
    )


def _asset_snapshot(asset) -> dict:
    return {
        "id": asset.id,
        "asset_type": asset.asset_type,
        "original_name": asset.original_name,
        "stored_name": asset.stored_name,
        "mime_type": asset.mime_type,
        "size_bytes": asset.size_bytes,
        "width": asset.width,
        "height": asset.height,
        "duration_seconds": asset.duration_seconds,
        "operation": asset.operation,
        "status": asset.status,
        "extra": asset.extra,
    }


async def _save_ai_task_candidate(
    db: AsyncSession,
    current_user: User,
    item_id: Optional[str],
    task_type: str,
    content: str,
) -> Optional[dict]:
    normalized = content.strip()
    if not item_id or not normalized:
        return None
    return await save_content_task_version(
        db,
        current_user.id,
        item_id,
        task_type,
        normalized,
        provider="ai",
    )


async def _finalize_content_ai_task(
    db: AsyncSession,
    current_user: User,
    task_type: str,
    result: TaskResult,
    item_id: Optional[str],
) -> None:
    await finalize_ai_task_result(
        db,
        current_user,
        task_type,
        result,
        object_type="content_item" if item_id else "content_request",
        object_id=item_id,
        source="content_factory",
    )


def _titles_candidate_content(titles: list[str]) -> str:
    return "\n".join(f"{index + 1}. {title}" for index, title in enumerate(titles) if title)


def _video_plan_candidate_content(result: dict) -> str:
    lines: list[str] = []
    for index, script in enumerate(result.get("scripts") or [], start=1):
        title = script.get("title") or f"脚本 {index}"
        lines.append(f"{index}. {title}")
        if script.get("hook"):
            lines.append(f"开场：{script['hook']}")
        if script.get("script"):
            lines.append(f"脚本：{script['script']}")
        shots = script.get("shots") or []
        if shots:
            lines.append("镜头：" + " / ".join(shots))
        tips = script.get("tips") or []
        if tips:
            lines.append("提示：" + " / ".join(tips))
    hashtags = result.get("hashtags") or []
    if hashtags:
        lines.append("标签：" + " ".join(hashtags))
    return "\n".join(lines)


def _task_result_candidate_content(result: TaskResult) -> str:
    data = result.data or {}
    if isinstance(data.get("text"), str):
        return data["text"]
    if isinstance(data.get("content"), str):
        return data["content"]
    if isinstance(data, dict):
        return "\n".join(f"{key}: {value}" for key, value in data.items() if value is not None)
    return str(data)
