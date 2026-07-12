"""Unified store access scope service."""

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.access_control import StoreMember
from app.models.platform_account import PlatformAccount
from app.models.user import User


async def list_accessible_store_ids(db: AsyncSession, user: User) -> list[str]:
    """Return platform account ids available to the current user."""
    if user.is_admin:
        result = await db.execute(select(PlatformAccount.id))
        return sorted(result.scalars().all())

    owned = await db.execute(select(PlatformAccount.id).where(PlatformAccount.user_id == user.id))
    member = await db.execute(
        select(StoreMember.platform_account_id).where(
            StoreMember.user_id == user.id,
            StoreMember.is_active == True,
        )
    )
    return sorted(set(owned.scalars().all()) | set(member.scalars().all()))


async def list_accessible_store_ids_for_user_id(db: AsyncSession, user_id: str) -> list[str]:
    """Load a user and return platform account ids available to that user."""
    user = await db.get(User, user_id)
    if not user:
        # Background jobs and imported legacy records can reference the stable
        # user id before a local User row has been materialized. Ownership is
        # still an explicit, safe scope; membership/admin expansion is not.
        owned = await db.execute(
            select(PlatformAccount.id).where(PlatformAccount.user_id == user_id)
        )
        return sorted(owned.scalars().all())
    return await list_accessible_store_ids(db, user)


async def can_access_store(db: AsyncSession, user: User, platform_account_id: str) -> bool:
    if user.is_admin:
        return True
    result = await db.execute(
        select(PlatformAccount.id).where(
            PlatformAccount.id == platform_account_id,
            PlatformAccount.user_id == user.id,
        )
    )
    if result.scalar_one_or_none():
        return True
    member = await db.execute(
        select(StoreMember.id).where(
            StoreMember.platform_account_id == platform_account_id,
            StoreMember.user_id == user.id,
            StoreMember.is_active == True,
        )
    )
    return member.scalar_one_or_none() is not None


async def store_scope_summary(db: AsyncSession, user: User) -> dict:
    store_ids = await list_accessible_store_ids(db, user)
    result = await db.execute(
        select(PlatformAccount).where(PlatformAccount.id.in_(store_ids))
        if store_ids
        else select(PlatformAccount).where(PlatformAccount.id == "__none__")
    )
    stores = [
        {
            "id": item.id,
            "platform": item.platform,
            "account_name": item.account_name,
            "shop_id": item.shop_id,
        }
        for item in result.scalars().all()
    ]
    return {
        "scope": "all" if user.is_admin else "assigned",
        "store_ids": store_ids,
        "stores": stores,
    }


async def list_store_access_matrix(db: AsyncSession) -> dict:
    """Return all stores and user-store memberships for admin screens."""
    stores = list((await db.execute(select(PlatformAccount).order_by(PlatformAccount.platform, PlatformAccount.account_name))).scalars().all())
    memberships = list((await db.execute(select(StoreMember).where(StoreMember.is_active == True))).scalars().all())
    stores_by_user: dict[str, list[str]] = {}
    for item in memberships:
        stores_by_user.setdefault(item.user_id, []).append(item.platform_account_id)
    return {
        "stores": [
            {
                "id": item.id,
                "platform": item.platform,
                "account_name": item.account_name,
                "shop_id": item.shop_id,
                "is_active": item.is_active,
            }
            for item in stores
        ],
        "user_stores": stores_by_user,
    }


async def replace_user_store_access(db: AsyncSession, target_user: User, store_ids: list[str], store_role: str = "operator") -> list[str]:
    """Replace a user's store access assignments and return normalized store ids."""
    unique_store_ids = sorted(set(store_ids))
    if unique_store_ids:
        result = await db.execute(
            select(PlatformAccount.id).where(
                PlatformAccount.id.in_(unique_store_ids),
                PlatformAccount.is_active == True,
            )
        )
        valid_store_ids = sorted(set(result.scalars().all()))
        invalid = sorted(set(unique_store_ids) - set(valid_store_ids))
        if invalid:
            raise ValueError(f"店铺不存在或已停用: {', '.join(invalid)}")
    else:
        valid_store_ids = []

    await db.execute(delete(StoreMember).where(StoreMember.user_id == target_user.id))
    for store_id in valid_store_ids:
        db.add(StoreMember(platform_account_id=store_id, user_id=target_user.id, store_role=store_role, data_scope="store", is_active=True))
    await db.commit()
    return valid_store_ids
