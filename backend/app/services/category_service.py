from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.category import Category


async def get_category_tree(db: AsyncSession):
    """Return categories as a flat list (frontend builds the tree)."""
    result = await db.execute(
        select(Category).order_by(Category.path, Category.sort_order)
    )
    return list(result.scalars().all())


async def create_category(
    db: AsyncSession,
    name: str,
    parent_id: Optional[str] = None,
    platform: Optional[str] = None,
    platform_category_id: Optional[str] = None,
) -> Category:
    cat = Category(
        name=name,
        parent_id=parent_id,
        platform=platform,
        platform_category_id=platform_category_id,
    )
    # Build path
    if parent_id:
        parent = await db.get(Category, parent_id)
        cat.path = f"{parent.path}/{name}" if parent and parent.path else name
    else:
        cat.path = name

    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


async def delete_category(db: AsyncSession, category_id: str):
    cat = await db.get(Category, category_id)
    if cat:
        await db.delete(cat)
        await db.commit()
