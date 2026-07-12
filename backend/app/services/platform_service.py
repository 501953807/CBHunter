from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.platform_account import PlatformAccount
from app.models.user import User
from app.schemas.platform import PlatformAccountAuthorizationUpdate, PlatformAccountCreate, PlatformAccountUpdate
from app.integrations.status import get_platform_connector_status
from app.services.store_access_service import can_access_store, list_accessible_store_ids
from app.utils.encryption import encrypt


async def create_platform_account(
    db: AsyncSession, user_id: str, req: PlatformAccountCreate
) -> PlatformAccount:
    account = PlatformAccount(
        user_id=user_id,
        platform=req.platform,
        account_name=req.account_name,
        shop_id=req.shop_id,
        api_key_encrypted=encrypt(req.api_key) if req.api_key else None,
        api_secret_encrypted=encrypt(req.api_secret) if req.api_secret else None,
        settings=req.settings or {},
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


async def get_user_platform_accounts(db: AsyncSession, user_id: str) -> list[PlatformAccount]:
    result = await db.execute(
        select(PlatformAccount)
        .where(PlatformAccount.user_id == user_id)
        .order_by(PlatformAccount.created_at)
    )
    return list(result.scalars().all())


async def get_accessible_platform_accounts(db: AsyncSession, user: User) -> list[PlatformAccount]:
    store_ids = await list_accessible_store_ids(db, user)
    if not store_ids:
        return []
    result = await db.execute(
        select(PlatformAccount)
        .where(PlatformAccount.id.in_(store_ids))
        .order_by(PlatformAccount.created_at)
    )
    return list(result.scalars().all())


async def get_accessible_platform_statuses(db: AsyncSession, user: User) -> list[dict]:
    accounts = await get_accessible_platform_accounts(db, user)
    return [get_platform_connector_status(account) for account in accounts]


async def get_platform_account(db: AsyncSession, account_id: str, user_id: str) -> PlatformAccount:
    result = await db.execute(
        select(PlatformAccount).where(
            PlatformAccount.id == account_id,
            PlatformAccount.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def get_accessible_platform_account(db: AsyncSession, account_id: str, user: User) -> PlatformAccount:
    if not await can_access_store(db, user, account_id):
        return None
    return await db.get(PlatformAccount, account_id)


async def get_manageable_platform_account(db: AsyncSession, account_id: str, user: User) -> PlatformAccount:
    if user.is_admin:
        return await db.get(PlatformAccount, account_id)
    return await get_platform_account(db, account_id, user.id)


async def update_platform_account(
    db: AsyncSession, account: PlatformAccount, req: PlatformAccountUpdate
) -> PlatformAccount:
    if req.account_name is not None:
        account.account_name = req.account_name
    if req.api_key is not None:
        account.api_key_encrypted = encrypt(req.api_key)
    if req.api_secret is not None:
        account.api_secret_encrypted = encrypt(req.api_secret)
    if req.settings is not None:
        account.settings = req.settings
    if req.is_active is not None:
        account.is_active = req.is_active
    await db.commit()
    await db.refresh(account)
    return account


async def update_platform_account_authorization(
    db: AsyncSession, account: PlatformAccount, req: PlatformAccountAuthorizationUpdate
) -> PlatformAccount:
    if req.access_token is not None:
        account.access_token_encrypted = encrypt(req.access_token)
    if req.refresh_token is not None:
        account.refresh_token_encrypted = encrypt(req.refresh_token)
    if req.token_expires_at is not None:
        account.token_expires_at = req.token_expires_at
    if req.token_scopes is not None:
        account.token_scopes = [scope.strip() for scope in req.token_scopes if scope.strip()]
    await db.commit()
    await db.refresh(account)
    return account


async def delete_platform_account(db: AsyncSession, account: PlatformAccount):
    await db.delete(account)
    await db.commit()
