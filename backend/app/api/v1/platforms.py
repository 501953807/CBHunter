from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.platform_account import PlatformAccount
from app.schemas.platform import (
    PlatformAccountAuthorizationUpdate,
    PlatformAccountCreate,
    PlatformAccountResponse,
    PlatformAccountUpdate,
)
from app.schemas.common import ApiResponse
from app.services.audit_service import record_audit_event
from app.services.entitlement_service import require_entitlement
from app.services.platform_service import (
    create_platform_account,
    get_accessible_platform_accounts,
    get_accessible_platform_statuses,
    get_accessible_platform_account,
    get_manageable_platform_account,
    update_platform_account_authorization,
    update_platform_account,
    delete_platform_account,
)
from app.services.evidence_service import source_ref

router = APIRouter(prefix="/platforms", tags=["platforms"])


@router.get("", response_model=ApiResponse)
async def list_platforms(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    accounts = await get_accessible_platform_accounts(db, current_user)
    return ApiResponse(
        data=[PlatformAccountResponse.model_validate(a) for a in accounts],
        status="ready" if accounts else "configuration_required",
        source_refs=[source_ref("platform_account", item.id, label=item.account_name) for item in accounts],
        evidence_window="当前用户可访问平台店铺",
        confidence_reason="账号列表已按当前用户店铺授权范围过滤；凭证只返回配置状态。",
        data_gaps=[] if accounts else ["暂无可访问平台店铺"],
    )


@router.post("", response_model=ApiResponse)
async def connect_platform(
    req: PlatformAccountCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account_count = await db.scalar(
        select(func.count(PlatformAccount.id)).where(PlatformAccount.user_id == current_user.id)
    ) or 0
    await require_entitlement(db, current_user, "stores.max", account_count + 1)
    account = await create_platform_account(db, current_user.id, req)
    await record_audit_event(
        db,
        user=current_user,
        action="platform_account_create",
        resource_type="platform_account",
        resource_id=account.id,
        new_value=_account_snapshot(account),
        detail="新增平台账号",
    )
    return ApiResponse(data=PlatformAccountResponse.model_validate(account))


@router.get("/status", response_model=ApiResponse)
async def get_platform_statuses(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    statuses = await get_accessible_platform_statuses(db, current_user)
    gaps = []
    if not statuses:
        gaps.append("暂无可检查的平台账号")
    for item in statuses:
        if not item.get("sync_ready"):
            reason = item.get("message") or f"{item.get('account_name')} 尚未就绪"
            if reason not in gaps:
                gaps.append(reason)
    return ApiResponse(
        data=statuses,
        status="ready" if statuses and not gaps else ("configuration_required" if statuses else "data_required"),
        source_refs=[source_ref("platform_account", item["account_id"], label=item.get("account_name")) for item in statuses],
        evidence_window="当前平台连接器与凭证状态",
        confidence_reason="同步就绪状态来自当前账号凭证和真实连接器实现能力，不执行模拟连通。",
        data_gaps=gaps,
    )


@router.get("/{account_id}", response_model=ApiResponse)
async def get_platform(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await get_accessible_platform_account(db, account_id, current_user)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform account not found")
    return ApiResponse(data=PlatformAccountResponse.model_validate(account))


@router.put("/{account_id}", response_model=ApiResponse)
async def update_platform(
    account_id: str,
    req: PlatformAccountUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await get_manageable_platform_account(db, account_id, current_user)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform account not found")
    old_value = _account_snapshot(account)
    updated = await update_platform_account(db, account, req)
    await record_audit_event(
        db,
        user=current_user,
        action="platform_account_update",
        resource_type="platform_account",
        resource_id=account.id,
        old_value=old_value,
        new_value={
            **_account_snapshot(updated),
            "api_key_changed": req.api_key is not None,
            "api_secret_changed": req.api_secret is not None,
        },
        detail="更新平台账号或凭证配置",
    )
    return ApiResponse(data=PlatformAccountResponse.model_validate(updated))


@router.put("/{account_id}/authorization", response_model=ApiResponse)
async def update_platform_authorization(
    account_id: str,
    req: PlatformAccountAuthorizationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await get_manageable_platform_account(db, account_id, current_user)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform account not found")
    old_value = _account_snapshot(account)
    updated = await update_platform_account_authorization(db, account, req)
    await record_audit_event(
        db,
        user=current_user,
        action="platform_account_authorization_update",
        resource_type="platform_account",
        resource_id=account.id,
        old_value=old_value,
        new_value={
            **_account_snapshot(updated),
            "access_token_changed": req.access_token is not None,
            "refresh_token_changed": req.refresh_token is not None,
            "token_expires_at": updated.token_expires_at.isoformat() if updated.token_expires_at else None,
            "token_scopes": updated.token_scopes or [],
        },
        detail="更新平台店铺 OAuth 授权令牌",
    )
    return ApiResponse(data=PlatformAccountResponse.model_validate(updated))


@router.delete("/{account_id}", response_model=ApiResponse)
async def disconnect_platform(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await get_manageable_platform_account(db, account_id, current_user)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform account not found")
    old_value = _account_snapshot(account)
    await delete_platform_account(db, account)
    await record_audit_event(
        db,
        user=current_user,
        action="platform_account_delete",
        resource_type="platform_account",
        resource_id=account_id,
        old_value=old_value,
        detail="删除平台账号",
    )
    return ApiResponse(data={"message": "Platform account disconnected"})


def _account_snapshot(account) -> dict:
    return {
        "id": account.id,
        "platform": account.platform,
        "account_name": account.account_name,
        "shop_id": account.shop_id,
        "is_active": account.is_active,
        "has_api_key": bool(account.api_key_encrypted),
        "has_api_secret": bool(account.api_secret_encrypted),
        "has_access_token": bool(account.access_token_encrypted),
        "has_refresh_token": bool(account.refresh_token_encrypted),
        "token_expires_at": account.token_expires_at.isoformat() if account.token_expires_at else None,
        "token_scopes": account.token_scopes or [],
    }
