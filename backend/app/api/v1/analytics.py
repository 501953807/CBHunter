from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services.analytics_service import (
    get_dashboard_kpis,
    get_sales_trend,
    get_platform_comparison,
    get_product_performance,
)
from app.services.evidence_service import evidence_payload, source_ref

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard", response_model=ApiResponse)
async def dashboard_kpis(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    kpis = await get_dashboard_kpis(db, current_user.id)
    return _analytics_response(kpis)


@router.get("/sales-trend", response_model=ApiResponse)
async def sales_trend(
    period: str = Query("7d", pattern=r"^(7d|30d|90d)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    trend = await get_sales_trend(db, current_user.id, period)
    order_count = sum(item["orders"] for item in trend)
    evidence = evidence_payload(
        source_refs=[source_ref("order", field="ordered_at", label="授权店铺订单")]
        if order_count else [],
        evidence_window=f"最近{period[:-1]}天",
        confidence_reason="趋势按授权店铺有效订单的下单日期逐日聚合；无订单日期补零仅用于保持时间轴连续。",
        data_gaps=[] if order_count else [f"最近{period[:-1]}天没有有效订单"],
    )
    return _analytics_response({
        "status": "ready" if order_count else "data_required",
        "period": period,
        "data": trend,
        **evidence,
    })


@router.get("/platform-comparison", response_model=ApiResponse)
async def platform_comparison(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    comparison = await get_platform_comparison(db, current_user.id)
    evidence = evidence_payload(
        source_refs=[source_ref("order", field="platform_account_id", label="授权店铺订单")]
        if comparison else [],
        evidence_window="最近30天",
        confidence_reason="平台销售额和订单数按授权店铺的非取消、非退款订单聚合。",
        data_gaps=[] if comparison else ["近30天没有可用于平台对比的有效订单"],
    )
    return _analytics_response({
        "status": "ready" if comparison else "data_required",
        "items": comparison,
        **evidence,
    })


@router.get("/product-performance", response_model=ApiResponse)
async def product_performance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    performance = await get_product_performance(db, current_user.id)
    has_records = bool(performance["top_performers"] or performance["bottom_performers"])
    return _analytics_response({
        **performance,
        "status": "ready" if has_records else "data_required",
        **evidence_payload(
            source_refs=[source_ref("order_item", label="授权店铺订单商品明细")]
            if performance["top_performers"] else [],
            evidence_window="最近30天",
            confidence_reason="热销商品按真实订单商品营收排序；无销量商品仅标记没有关联销量记录，不推断滞销天数。",
            data_gaps=[] if has_records else ["缺少可分析的订单商品或在售 Listing"],
        ),
    })


def _analytics_response(payload: dict) -> ApiResponse:
    return ApiResponse(
        data=payload,
        status=payload.get("status"),
        source_refs=payload.get("source_refs") or [],
        evidence_window=payload.get("evidence_window"),
        confidence_reason=payload.get("confidence_reason"),
        data_gaps=payload.get("data_gaps") or [],
    )
