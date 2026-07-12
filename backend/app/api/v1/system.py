import math
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.network import check_status
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


@router.get("/stats")
async def stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tables = [
        "users", "platform_accounts", "products", "platform_listings",
        "orders", "order_items", "shipments", "listing_templates",
        "categories", "ai_suggestions",
    ]
    counts = {}
    for table in tables:
        result = await db.execute(text(f"SELECT COUNT(*) FROM {table}"))
        counts[table] = result.scalar()
    return {"data": {"table_counts": counts}}


@router.get("/network", response_model=ApiResponse)
async def network_status(
    current_user: User = Depends(get_current_user),
):
    """Get current network status (cached)."""
    status = await check_status()
    return ApiResponse(data=status)


@router.post("/network/refresh", response_model=ApiResponse)
async def refresh_network(
    current_user: User = Depends(get_current_user),
):
    """Force re-check network status (e.g., after VPN toggle)."""
    status = await check_status(force_refresh=True)
    return ApiResponse(data={"status": status["status"], "overseas": status["overseas"]})
