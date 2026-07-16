"""API endpoints for product discovery and trend tracking."""

import io
import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.system_config import SystemConfig
from app.models.user import User
from app.models.product_discovery import ProductDiscovery
from app.schemas.common import ApiResponse
from app.api.v1.response_helpers import evidence_response
from app.schemas.discovery import (
    DiscoveryCreate, DiscoveryUpdate, DiscoveryDecision,
    DiscoveryResponse, DiscoveryPipelineStats,
)
from app.services.discovery_service import (
    create_discovery, list_discoveries, analyze_discovery,
    update_discovery, reanalyze_discovery,
    update_discovery_decision, get_discovery_stats,
    ensure_image_dir, IMAGE_DIR,
)
from app.services.image_analysis import extract_analysis
from app.services.ai_analysis import analyze_with_ai
from app.services import config_service
from app.services.audit_service import record_audit_event
from app.services.ai_usage_audit_service import finalize_ai_task_result
from app.services.entitlement_service import require_entitlement
from app.services.evidence_service import configuration_required, data_required
from app.services.system_config_service import get_config, get_gemini_key
from app.services.task_executor import TaskResult
from app.utils.encryption import encrypt

router = APIRouter(prefix="/discovery", tags=["discovery"])


class AiConfigUpdate(BaseModel):
    api_key: Optional[str] = None
    provider: Optional[str] = None


# ========== Discovery endpoints ==========

@router.get("/pipeline", response_model=ApiResponse)
async def discovery_pipeline(
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    decision: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, total = await list_discoveries(db, current_user.id, category, status, decision, page, page_size)
    return ApiResponse(
        data=[DiscoveryResponse.model_validate(i) for i in items],
        meta={
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size,
        },
    )


@router.post("/create", response_model=ApiResponse)
async def create_discovery_endpoint(
    req: DiscoveryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    discovery = await create_discovery(db, current_user.id, req.model_dump())
    await record_audit_event(
        db,
        user=current_user,
        action="create",
        resource_type="product_discovery",
        resource_id=discovery.id,
        new_value=_discovery_snapshot(discovery),
        detail="创建选品发现记录",
    )
    return ApiResponse(data=DiscoveryResponse.model_validate(discovery))


@router.get("/images/{filename}")
async def get_discovery_image(filename: str):
    """Serve uploaded discovery images."""
    from app.services.discovery_service import IMAGE_DIR
    if filename != os.path.basename(filename):
        raise HTTPException(status_code=400, detail="Invalid image filename")
    filepath = os.path.join(IMAGE_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(filepath)


MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB

@router.post("/upload-image", response_model=ApiResponse)
async def upload_discovery_image(
    file: UploadFile = File(...),
    category: str = Form(""),
    market: Optional[str] = Form(None),
    notes: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a product image for discovery. Max file size: 10 MB."""
    ensure_image_dir()

    # Validate file size
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"文件大小超过限制（最大 {MAX_UPLOAD_SIZE // (1024*1024)} MB）",
        )
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="文件为空")

    try:
        from PIL import Image
        with Image.open(io.BytesIO(content)) as uploaded_image:
            uploaded_image.verify()
            image_format = (uploaded_image.format or "").upper()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="上传文件不是有效图片") from exc
    extension_by_format = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}
    ext = extension_by_format.get(image_format)
    if not ext:
        raise HTTPException(status_code=400, detail="仅支持 JPEG、PNG、WEBP 图片")
    ai_api_key = await get_gemini_key(db)
    if ai_api_key:
        await require_entitlement(db, current_user, "ai.tasks.monthly")
    filename = f"{current_user.id[:8]}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(IMAGE_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(content)

    # Create discovery entry
    discovery = await create_discovery(db, current_user.id, {
        "source_type": "image_upload",
        "source_image": filename,
        "category": category,
        "market": market,
        "notes": notes,
    })

    # Run AI-powered analysis if API key is configured in system_config.
    analysis = None
    ai_used = False
    ocr_text = ""
    ai_provider = await get_config(db, "ai_provider") or "gemini"
    if ai_api_key:
        try:
            analysis = await analyze_with_ai(filepath, api_key=ai_api_key, provider=ai_provider)
            if analysis:
                ai_used = True
                await finalize_ai_task_result(
                    db,
                    current_user,
                    "image_understanding",
                    TaskResult(True, analysis, provider=ai_provider, confidence="medium"),
                    object_type="product_discovery",
                    object_id=discovery.id,
                    source="discovery_image_upload",
                )
                logger.info("AI analysis successful via %s", ai_provider)
            else:
                await finalize_ai_task_result(
                    db,
                    current_user,
                    "image_understanding",
                    TaskResult(True, {}, provider=ai_provider, confidence="medium"),
                    object_type="product_discovery",
                    object_id=discovery.id,
                    source="discovery_image_upload",
                )
                logger.warning("AI analysis returned None (quota exceeded?)")
        except Exception as e:
            logger.error(f"AI analysis error: {e}")
            await finalize_ai_task_result(
                db,
                current_user,
                "image_understanding",
                TaskResult(False, provider=ai_provider, error=str(e)),
                object_type="product_discovery",
                object_id=discovery.id,
                source="discovery_image_upload",
            )

    # Fallback: OCR + rule-based analysis
    if not analysis:
        ocr_text = ""
        try:
            import pytesseract
            from PIL import Image
            img = Image.open(filepath)
            ocr_text = pytesseract.image_to_string(img, lang='eng+chi_sim')
        except Exception as e:
            logger.warning(f"OCR failed: {e}")

        analysis = extract_analysis(ocr_text, category) if category else {}

    # Auto-analyze
    if ocr_text.strip():
        discovery = await analyze_discovery(db, discovery.id, current_user.id, ocr_text)
    else:
        discovery = await analyze_discovery(db, discovery.id, current_user.id)

    # Match trend keywords - grouped by market
    matched_trends = []
    if analysis and category:
        from app.models.trend_keyword import TrendKeyword

        # Strategy 1: Match by category (all keywords in this product's category)
        cat_result = await db.execute(
            select(TrendKeyword).where(
                or_(TrendKeyword.user_id == current_user.id, TrendKeyword.user_id.is_(None)),
                TrendKeyword.category == category,
            ).limit(20)
        )
        matched_trends = [{"keyword": kw.keyword, "market": kw.market} for kw in cat_result.scalars()]

        # Deduplicate
        seen = set()
        unique_trends = []
        for t in matched_trends:
            key = f"{t['keyword']}_{t['market']}"
            if key not in seen:
                seen.add(key)
                unique_trends.append(t)
        matched_trends = unique_trends[:30]  # Keep more for market grouping

    # Recommended market based on positioning
    from app.services.image_analysis import recommend_market
    market_recs = recommend_market(analysis) if analysis else []

    # Store analysis in discovery record
    if analysis:
        discovery.full_analysis = {
            "analysis": analysis,
            "ai_used": ai_used,
            "matched_trends": matched_trends,
            "market_recommendations": market_recs,
        }
        db.add(discovery)
        await db.commit()

    await record_audit_event(
        db,
        user=current_user,
        action="upload_image",
        resource_type="product_discovery",
        resource_id=discovery.id,
        new_value=_discovery_snapshot(discovery),
        detail="上传图片并创建选品发现记录",
    )

    return ApiResponse(data={
        **DiscoveryResponse.model_validate(discovery).model_dump(),
        "ocr_text": ocr_text[:500] if not ai_used and ocr_text else None,
        "analysis": analysis,
        "ai_used": ai_used,
        "matched_trends": matched_trends,
        "market_recommendations": market_recs,
    })


import logging
logger = logging.getLogger(__name__)


@router.get("/pending-images", response_model=ApiResponse)
async def list_pending_images(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """返回尚未确认的图片选品列表（用于图片选品左侧缩略图面板）."""
    from sqlalchemy import select
    result = await db.execute(
        select(ProductDiscovery).where(
            ProductDiscovery.user_id == current_user.id,
            ProductDiscovery.source_type == "image_upload",
            ProductDiscovery.source_image.isnot(None),
        ).order_by(ProductDiscovery.created_at.desc())
    )
    items = result.scalars().all()
    # Return only basic info for thumbnails, exclude analysis to keep response small
    thumbnails = []
    for item in items:
        # Skip confirmed items by checking if there's a sourcing record linked
        full = item.full_analysis or {}
        ai_used = full.get("ai_used", False)
        thumbnails.append({
            "id": item.id,
            "image_url": f"/api/v1/discovery/images/{item.source_image}" if item.source_image else None,
            "category": item.category,
            "market": item.market,
            "product_name": item.product_name,
            "status": item.status,
            "ai_used": ai_used,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "has_analysis": bool(item.full_analysis and item.full_analysis.get("analysis")),
        })
    return ApiResponse(data=thumbnails)


@router.put("/ai-config", response_model=ApiResponse)
async def update_ai_config(
    req: AiConfigUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update AI analysis config."""
    old_provider = await get_config(db, "ai_provider") or "gemini"
    old_api_key = await get_gemini_key(db)
    old_value = {
        "provider": old_provider,
        "api_key_configured": bool(old_api_key),
    }
    if req.api_key is not None:
        await _upsert_discovery_ai_config(
            db,
            "gemini_api_key",
            encrypt(req.api_key) if req.api_key else None,
            "Gemini API Key",
        )
    if req.provider is not None:
        await _upsert_discovery_ai_config(db, "ai_provider", req.provider or None, "AI Provider")
    await db.commit()
    new_provider = await get_config(db, "ai_provider") or "gemini"
    new_api_key = await get_gemini_key(db)
    await record_audit_event(
        db,
        user=admin,
        action="update",
        resource_type="discovery_ai_config",
        resource_id="global",
        old_value=old_value,
        new_value={
            "provider": new_provider,
            "api_key_configured": bool(new_api_key),
        },
        detail="更新选品发现 AI 配置",
    )
    return ApiResponse(data={"message": "AI config updated", "provider": new_provider})


@router.put("/{discovery_id}", response_model=ApiResponse)
async def edit_discovery(
    discovery_id: str,
    req: DiscoveryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Edit a discovery record."""
    existing = await _get_discovery(db, discovery_id, current_user.id)
    if not existing:
        raise HTTPException(status_code=404, detail="Discovery not found")
    old_value = _discovery_snapshot(existing)
    discovery = await update_discovery(db, discovery_id, current_user.id, req.model_dump(exclude_unset=True))
    if not discovery:
        raise HTTPException(status_code=404, detail="Discovery not found")
    await record_audit_event(
        db,
        user=current_user,
        action="update",
        resource_type="product_discovery",
        resource_id=discovery.id,
        old_value=old_value,
        new_value=_discovery_snapshot(discovery),
        detail="更新选品发现记录",
    )
    return ApiResponse(data=DiscoveryResponse.model_validate(discovery))


@router.post("/{discovery_id}/reanalyze", response_model=ApiResponse)
async def reanalyze_discovery_endpoint(
    discovery_id: str,
    provider: Optional[str] = Query(None, description="AI provider to use"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-run AI analysis on a discovery (optionally switch provider)."""
    existing = await _get_discovery(db, discovery_id, current_user.id)
    if not existing:
        raise HTTPException(status_code=404, detail="Discovery not found")
    old_value = _discovery_snapshot(existing)
    discovery = await reanalyze_discovery(db, discovery_id, current_user.id, provider)
    if not discovery:
        raise HTTPException(status_code=404, detail="Discovery not found")
    await record_audit_event(
        db,
        user=current_user,
        action="reanalyze",
        resource_type="product_discovery",
        resource_id=discovery.id,
        old_value=old_value,
        new_value=_discovery_snapshot(discovery),
        detail="重新分析选品发现记录",
    )
    return ApiResponse(data=DiscoveryResponse.model_validate(discovery))


@router.delete("/{discovery_id}", response_model=ApiResponse)
async def delete_discovery(
    discovery_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除一个发现记录及其图片."""
    from app.services.discovery_service import IMAGE_DIR
    import os
    result = await db.execute(
        select(ProductDiscovery).where(
            ProductDiscovery.id == discovery_id,
            ProductDiscovery.user_id == current_user.id,
        )
    )
    discovery = result.scalar_one_or_none()
    if not discovery:
        raise HTTPException(status_code=404, detail="Not found")
    old_value = _discovery_snapshot(discovery)
    # Delete image file
    if discovery.source_image:
        fpath = os.path.join(IMAGE_DIR, discovery.source_image)
        if os.path.exists(fpath):
            os.remove(fpath)
    await db.delete(discovery)
    await db.commit()
    await record_audit_event(
        db,
        user=current_user,
        action="delete",
        resource_type="product_discovery",
        resource_id=discovery_id,
        old_value=old_value,
        detail="删除选品发现记录及图片",
    )
    return ApiResponse(data={"message": "Deleted"})


@router.post("/analyze/{discovery_id}", response_model=ApiResponse)
async def analyze_discovery_endpoint(
    discovery_id: str,
    ocr_text: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await _get_discovery(db, discovery_id, current_user.id)
    if not existing:
        raise HTTPException(status_code=404, detail="Discovery not found")
    old_value = _discovery_snapshot(existing)
    discovery = await analyze_discovery(db, discovery_id, current_user.id, ocr_text)
    if not discovery:
        raise HTTPException(status_code=404, detail="Discovery not found")
    await record_audit_event(
        db,
        user=current_user,
        action="analyze",
        resource_type="product_discovery",
        resource_id=discovery.id,
        old_value=old_value,
        new_value=_discovery_snapshot(discovery),
        detail="分析选品发现记录",
    )
    return ApiResponse(data=DiscoveryResponse.model_validate(discovery))


@router.post("/{discovery_id}/confirm", response_model=ApiResponse)
async def confirm_discovery(
    discovery_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm a discovery: add to sourcing library + open TEMU/1688 search."""
    from app.services.sourcing_service import create_item
    from app.services.discovery_service import update_discovery_decision

    # Get discovery
    result = await db.execute(
        select(ProductDiscovery).where(
            ProductDiscovery.id == discovery_id,
            ProductDiscovery.user_id == current_user.id,
        )
    )
    discovery = result.scalar_one_or_none()
    if not discovery:
        raise HTTPException(status_code=404, detail="Not found")
    old_value = _discovery_snapshot(discovery)

    # Mark as pursued
    await update_discovery_decision(db, discovery_id, current_user.id, "pursue")

    # Get analysis data from stored full_analysis
    full = discovery.full_analysis or {}
    analysis_data = full.get("analysis", {})
    market_recs = full.get("market_recommendations", [])

    # Category & search term
    category = discovery.category or ""
    search_term = (discovery.product_name or discovery.product_type or category).split("/")[0].strip()

    # Best market
    best_market = discovery.market
    if market_recs:
        best_market = market_recs[0].get("market", best_market)

    # Titles
    titles = analysis_data.get("titles", {})
    cn_title = (titles.get("chinese") or "")[:200]
    en_title = (titles.get("english") or "")[:200]

    # Determine trend top-level category from analysis
    trend_cat = category
    categories = await config_service.get_categories(db)
    cat_ids = {c["id"]: c["label"] for c in categories}
    # Use the category field directly (already mapped to trend categories)

    sourcing = await create_item(db, current_user.id, {
        "source_name": "image_discovery",
        "source_image": discovery.source_image,
        "source_price_rmb": discovery.sourcing_price_rmb,
        "product_name": cn_title or discovery.product_name or search_term,
        "product_name_cn": en_title or "",
        "weight_g": None,
        "category": cat_ids.get(category, category),
        "market": best_market,
        "pipeline_stage": "discovery",
        "notes": f"AI来源: {'Gemini' if full.get('ai_used') else 'OCR'} | 匹配市场: {', '.join(m['market'] for m in market_recs[:2])}",
        "extra_data": {
            "discovery_id": discovery_id,
            "titles": titles,
            "market_recs": market_recs,
            "trend_category": cat_ids.get(category, category),
        },
    })
    await record_audit_event(
        db,
        user=current_user,
        action="confirm",
        resource_type="product_discovery",
        resource_id=discovery_id,
        old_value=old_value,
        new_value={"sourcing_id": sourcing.id, "decision": "pursue"},
        detail="确认选品并加入品源库",
    )
    await record_audit_event(
        db,
        user=current_user,
        action="create",
        resource_type="sourcing_item",
        resource_id=sourcing.id,
        new_value={
            "id": sourcing.id,
            "source_name": sourcing.source_name,
            "source_image": sourcing.source_image,
            "source_price_rmb": sourcing.source_price_rmb,
            "product_name": sourcing.product_name,
            "category": sourcing.category,
            "market": sourcing.market,
            "pipeline_stage": sourcing.pipeline_stage,
            "extra_data": sourcing.extra_data,
        },
        detail="由选品发现确认生成品源记录",
    )

    # Generate search URLs for TEMU and Shopee
    import urllib.parse
    temu_url = f"https://www.temu.com/search?q={urllib.parse.quote(search_term)}"

    return ApiResponse(data={
        "sourcing_id": sourcing.id,
        "search_term": search_term,
        "temu_search_url": temu_url,
        "message": "已确认选品，可在选品库中查看和管理供应商",
    })


@router.post("/{discovery_id}/decision", response_model=ApiResponse)
async def make_decision(
    discovery_id: str,
    req: DiscoveryDecision,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await _get_discovery(db, discovery_id, current_user.id)
    if not existing:
        raise HTTPException(status_code=404, detail="Discovery not found")
    old_value = _discovery_snapshot(existing)
    discovery = await update_discovery_decision(db, discovery_id, current_user.id, req.decision, req.reason)
    if not discovery:
        raise HTTPException(status_code=404, detail="Discovery not found")
    await record_audit_event(
        db,
        user=current_user,
        action="decision",
        resource_type="product_discovery",
        resource_id=discovery.id,
        old_value=old_value,
        new_value=_discovery_snapshot(discovery),
        detail="更新选品决策",
    )
    return ApiResponse(data=DiscoveryResponse.model_validate(discovery))


@router.get("/stats", response_model=ApiResponse)
async def pipeline_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stats = await get_discovery_stats(db, current_user.id)
    return ApiResponse(data=DiscoveryPipelineStats(**stats))


@router.get("/ai-config", response_model=ApiResponse)
async def get_ai_config(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get current AI analysis config (masked API key)."""
    key = await get_gemini_key(db) or ""
    masked = key[:6] + "..." + key[-4:] if len(key) > 12 else ("已配置" if key else "")
    return ApiResponse(data={
        "provider": await get_config(db, "ai_provider") or "gemini",
        "api_key_configured": bool(key),
        "api_key_preview": masked,
    })


class RecommendRequest(BaseModel):
    prompt: str


@router.post("/recommend", response_model=ApiResponse)
async def ai_recommend(
    req: RecommendRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a prompt to Gemini AI for product/market analysis."""
    api_key = await get_gemini_key(db)
    if not api_key:
        await finalize_ai_task_result(
            db,
            current_user,
            "decision_analysis",
            TaskResult(False, provider="gemini", error="gemini_api_key_missing"),
            object_type="discovery_recommend",
            object_id="recommend",
            source="discovery_recommend",
        )
        return evidence_response(configuration_required(
            "AI API Key 未配置，请在设置中心配置 Gemini API Key。",
            data_gaps=["system_config.gemini_api_key"],
            evidence_window="当前系统配置",
        ))

    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    await require_entitlement(db, current_user, "ai.tasks.monthly")

    try:
        from google import genai

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=[req.prompt],
        )
        content = (response.text or "").strip()
        if not content:
            await finalize_ai_task_result(
                db,
                current_user,
                "decision_analysis",
                TaskResult(True, {}, provider="gemini", confidence="medium"),
                object_type="discovery_recommend",
                object_id="recommend",
                source="discovery_recommend",
            )
            return evidence_response({
                "content": "",
                **data_required(
                    "AI 未返回可用推荐内容。",
                    data_gaps=["ai_generation_result"],
                    evidence_window="当前请求输入",
                ),
            })
        await finalize_ai_task_result(
            db,
            current_user,
            "decision_analysis",
            TaskResult(True, {"content": content}, provider="gemini", confidence="high"),
            object_type="discovery_recommend",
            object_id="recommend",
            source="discovery_recommend",
        )
        return ApiResponse(data={"content": content})
    except Exception as e:
        logger.error(f"Gemini recommend failed: {e}")
        await finalize_ai_task_result(
            db,
            current_user,
            "decision_analysis",
            TaskResult(False, provider="gemini", error=str(e)),
            object_type="discovery_recommend",
            object_id="recommend",
            source="discovery_recommend",
        )
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")


async def _get_discovery(db: AsyncSession, discovery_id: str, user_id: str) -> Optional[ProductDiscovery]:
    result = await db.execute(
        select(ProductDiscovery).where(
            ProductDiscovery.id == discovery_id,
            ProductDiscovery.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def _upsert_discovery_ai_config(
    db: AsyncSession,
    key: str,
    value: Optional[str],
    label: str,
) -> None:
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    row = result.scalar_one_or_none()
    if row:
        row.value = value
        row.label = label
    else:
        db.add(SystemConfig(key=key, value=value, label=label))


def _discovery_snapshot(discovery: ProductDiscovery) -> dict:
    return {
        "id": discovery.id,
        "source_type": discovery.source_type,
        "source_image": discovery.source_image,
        "source_url": discovery.source_url,
        "product_name": discovery.product_name,
        "product_type": discovery.product_type,
        "category": discovery.category,
        "market": discovery.market,
        "features": discovery.features,
        "selling_points": discovery.selling_points,
        "target_audience": discovery.target_audience,
        "matched_trend_keywords": discovery.matched_trend_keywords,
        "trend_score": discovery.trend_score,
        "market_demand": discovery.market_demand,
        "sourcing_price_rmb": discovery.sourcing_price_rmb,
        "suggested_price_local": discovery.suggested_price_local,
        "estimated_profit_margin": discovery.estimated_profit_margin,
        "status": discovery.status,
        "decision": discovery.decision,
        "decision_reason": discovery.decision_reason,
        "notes": discovery.notes,
        "tags": discovery.tags,
        "analyzed_at": discovery.analyzed_at,
    }
