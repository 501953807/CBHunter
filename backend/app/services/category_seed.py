"""Seed categories based on market research for each platform."""

import json
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession
from app.models.category import Category

CATEGORY_TREE_PATH = Path(__file__).resolve().parents[1] / "data" / "default_category_tree.json"


def load_seed_categories() -> list[dict]:
    with CATEGORY_TREE_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


async def seed_categories(db: AsyncSession):
    """Seed categories if the table is empty."""
    from sqlalchemy import select, func
    result = await db.execute(select(func.count(Category.id)))
    count = result.scalar()

    if count > 0:
        return {"seeded": False, "message": f"Categories already exist ({count} records)"}

    created = 0
    for parent_cat in load_seed_categories():
        parent = Category(
            name=parent_cat["name"],
            platform=parent_cat["platform"],
            path=parent_cat["name"],
            sort_order=0,
        )
        db.add(parent)
        await db.flush()
        created += 1

        for i, child_name in enumerate(parent_cat["children"]):
            child = Category(
                name=child_name,
                parent_id=parent.id,
                platform=parent_cat["platform"],
                path=f"{parent_cat['name']}/{child_name}",
                sort_order=i,
            )
            db.add(child)
            created += 1

    await db.commit()
    return {"seeded": True, "message": f"Created {created} categories"}
