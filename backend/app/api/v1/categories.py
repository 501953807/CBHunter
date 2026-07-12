from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.category import Category
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services.category_service import get_category_tree, create_category, delete_category
from app.services.category_seed import seed_categories
from app.services.audit_service import record_audit_event

router = APIRouter(prefix="/categories", tags=["categories"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=ApiResponse)
async def list_categories(db: AsyncSession = Depends(get_db)):
    cats = await get_category_tree(db)
    return ApiResponse(data=[
        {
            "id": c.id,
            "name": c.name,
            "parent_id": c.parent_id,
            "platform": c.platform,
            "platform_category_id": c.platform_category_id,
            "path": c.path,
            "sort_order": c.sort_order,
        }
        for c in cats
    ])


@router.post("", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def create_category_endpoint(
    name: str,
    parent_id: Optional[str] = None,
    platform: Optional[str] = None,
    platform_category_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    cat = await create_category(db, name, parent_id, platform, platform_category_id)
    await record_audit_event(
        db,
        user=current_user,
        action="create",
        resource_type="category",
        resource_id=cat.id,
        new_value=_category_snapshot(cat),
        detail="创建品类",
    )
    return ApiResponse(data={"id": cat.id, "name": cat.name, "path": cat.path})


@router.delete("/{category_id}", response_model=ApiResponse)
async def delete_category_endpoint(
    category_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    cat = await db.get(Category, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    old_value = _category_snapshot(cat)
    await delete_category(db, category_id)
    await record_audit_event(
        db,
        user=current_user,
        action="delete",
        resource_type="category",
        resource_id=category_id,
        old_value=old_value,
        detail="删除品类",
    )
    return ApiResponse(data={"message": "Category deleted"})


@router.post("/seed", response_model=ApiResponse)
async def seed_categories_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Seed default categories based on market research."""
    result = await seed_categories(db)
    await record_audit_event(
        db,
        user=current_user,
        action="seed",
        resource_type="category",
        resource_id="defaults",
        new_value=result,
        detail="初始化默认品类",
    )
    return ApiResponse(data=result)


def _category_snapshot(category: Category) -> dict:
    return {
        "id": category.id,
        "name": category.name,
        "parent_id": category.parent_id,
        "platform": category.platform,
        "platform_category_id": category.platform_category_id,
        "path": category.path,
        "sort_order": category.sort_order,
    }
