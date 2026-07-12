"""Simple health check endpoint — no dependencies, always responds."""
from fastapi import APIRouter
from app.schemas.common import ApiResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=ApiResponse)
async def health_check():
    return ApiResponse(data={"status": "ok", "service": "CBHunter API"})
