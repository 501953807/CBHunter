"""API endpoints for product classification and analysis."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services.evidence_service import source_ref
from app.services.product_analysis import rank_new_products

router = APIRouter(prefix="/products/analysis", tags=["product-analysis"])


@router.get("/new-rankings", response_model=ApiResponse)
async def new_product_rankings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get new products sorted by listing-data completeness."""
    ranked = await rank_new_products(db, current_user.id)
    top_ranked = ranked[:50]
    return ApiResponse(
        data={
            "total": len(ranked),
            "ranked": top_ranked,
        },
        status="ready" if ranked else "data_required",
        source_refs=[source_ref("product", item.get("id"), label=item.get("name")) for item in top_ranked[:10]],
        evidence_window="当前商品主数据与订单明细快照",
        confidence_reason="新品排序只读取当前用户未产生订单的在售商品，并按图片、描述、采购价、重量和货源字段完整度排序。",
        data_gaps=[] if ranked else ["当前没有可用于新品排序的在售商品"],
    )
