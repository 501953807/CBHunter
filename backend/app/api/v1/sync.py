from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.sync_log import SyncLog
from app.models.platform_account import PlatformAccount
from app.schemas.common import ApiResponse
from app.api.v1.response_helpers import evidence_response
from app.services.sync_service import SyncService
from app.integrations.status import get_platform_connector_status, is_order_sync_ready, is_product_sync_ready
from app.services.audit_service import record_audit_event
from app.services.evidence_service import configuration_required, data_required, evidence_payload, source_ref
from app.services.store_access_service import can_access_store, list_accessible_store_ids

router = APIRouter(prefix="/sync", tags=["sync"])


@router.get("/status", response_model=ApiResponse)
async def sync_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return sync status for the current user's platform accounts."""
    store_ids = await list_accessible_store_ids(db, current_user)
    result = await db.execute(
        select(PlatformAccount).where(PlatformAccount.id.in_(store_ids))
    )
    accounts = list(result.scalars().all())

    statuses = []
    for acc in accounts:
        log_result = await db.execute(
            select(SyncLog)
            .where(SyncLog.platform_account_id == acc.id)
            .order_by(SyncLog.started_at.desc())
            .limit(1)
        )
        last_log = log_result.scalar_one_or_none()

        statuses.append({
            "account_id": acc.id,
            "platform": acc.platform,
            "account_name": acc.account_name,
            "is_active": acc.is_active,
            "last_sync_at": acc.last_sync_at.isoformat() if acc.last_sync_at else None,
            "last_sync_status": last_log.status if last_log else None,
            "last_sync_time": last_log.started_at.isoformat() if last_log else None,
            "records_processed": last_log.records_processed if last_log else 0,
            "connector": get_platform_connector_status(acc),
        })

    return ApiResponse(data=statuses)


@router.post("/trigger", response_model=ApiResponse)
async def trigger_sync(
    platform_account_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SyncService(db)

    if platform_account_id:
        if not await can_access_store(db, current_user, platform_account_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Platform account not found",
            )
        result = await db.execute(
            select(PlatformAccount).where(
                PlatformAccount.id == platform_account_id,
            )
        )
        account = result.scalar_one_or_none()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Platform account not found",
            )
        if not is_order_sync_ready(account):
            connector = get_platform_connector_status(account)
            await service.record_blocked_sync(
                account,
                "orders",
                connector["message"],
                [{"reason": "connector_not_ready", "connector": connector}],
            )
            await record_audit_event(
                db,
                user=current_user,
                action="order_sync_blocked",
                resource_type="platform_account",
                resource_id=account.id,
                new_value={"connector": connector},
                detail="平台订单同步因真实 Open API 或凭证未就绪被阻断",
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=configuration_required(
                    connector["message"],
                    data_gaps=connector.get("missing_fields") or ["platform_open_api"],
                    source_refs=[source_ref("platform_account", account.id)],
                    evidence_window="当前平台账号配置",
                ),
            )
        log = await service.sync_orders_for_account(account)
        await record_audit_event(
            db,
            user=current_user,
            action="order_sync_trigger",
            resource_type="platform_account",
            resource_id=account.id,
            new_value={
                "status": log.status,
                "records_processed": log.records_processed,
                "records_created": log.records_created,
                "records_updated": log.records_updated,
                "records_failed": log.records_failed,
            },
            detail="手工触发平台订单同步",
        )
        return ApiResponse(data=_sync_result_payload(log))
    else:
        store_ids = await list_accessible_store_ids(db, current_user)
        result = await db.execute(
            select(PlatformAccount).where(
                PlatformAccount.id.in_(store_ids),
                PlatformAccount.is_active == True,
            )
        )
        accounts = list(result.scalars().all())
        if not accounts:
            return evidence_response(data_required(
                "当前没有可同步的平台账号",
                data_gaps=["platform_accounts"],
                evidence_window="当前用户平台账号配置",
            ))
        unavailable = [
            get_platform_connector_status(account)
            for account in accounts
            if not is_order_sync_ready(account)
        ]
        if unavailable:
            accounts_by_id = {account.id: account for account in accounts}
            for connector in unavailable:
                blocked_account = accounts_by_id.get(connector["account_id"])
                if blocked_account:
                    await service.record_blocked_sync(
                        blocked_account,
                        "orders",
                        connector["message"],
                        [{"reason": "connector_not_ready", "connector": connector}],
                    )
            await record_audit_event(
                db,
                user=current_user,
                action="order_sync_blocked",
                resource_type="platform_account",
                resource_id="all",
                new_value={"accounts": unavailable},
                detail="批量订单同步因部分平台账号未就绪被阻断",
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=configuration_required(
                    "存在尚未接通真实 Open API 的平台账号",
                    data_gaps=["platform_open_api", "platform_credentials"],
                    source_refs=[source_ref("platform_account", item["account_id"]) for item in unavailable],
                    evidence_window="当前用户平台账号配置",
                    confidence_reason="只有真实 Open API、凭证和访问令牌均就绪的平台账号才允许同步。",
                ) | {"accounts": unavailable},
            )
        logs = await service.sync_all_platforms(account_ids=store_ids)
        await record_audit_event(
            db,
            user=current_user,
            action="order_sync_trigger",
            resource_type="platform_account",
            resource_id="all",
            new_value={
                "account_count": len(accounts),
                "logs": [
                    {
                        "account_id": log.platform_account_id,
                        "status": log.status,
                        "records_processed": log.records_processed,
                        "records_failed": log.records_failed,
                        "error_message": log.error_message,
                    }
                    for log in logs
                ],
            },
            detail="手工触发全部平台订单同步",
        )
        return ApiResponse(data=[_sync_result_payload(log) for log in logs])


@router.post("/products/trigger", response_model=ApiResponse)
async def trigger_product_sync(
    platform_account_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SyncService(db)
    if platform_account_id:
        if not await can_access_store(db, current_user, platform_account_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform account not found")
        account = (await db.execute(select(PlatformAccount).where(PlatformAccount.id == platform_account_id))).scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform account not found")
        if not is_product_sync_ready(account):
            connector = get_platform_connector_status(account)
            await service.record_blocked_sync(
                account,
                "products",
                connector["message"],
                [{"reason": "connector_not_ready", "connector": connector}],
            )
            await record_audit_event(
                db,
                user=current_user,
                action="product_sync_blocked",
                resource_type="platform_account",
                resource_id=account.id,
                new_value={"connector": connector},
                detail="平台商品同步因真实 Open API 或凭证未就绪被阻断",
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=configuration_required(
                    connector["message"],
                    data_gaps=connector.get("missing_fields") or ["platform_products_open_api"],
                    source_refs=[source_ref("platform_account", account.id)],
                    evidence_window="当前平台账号配置",
                    confidence_reason="只有真实 Open API 商品接口、凭证和访问令牌均就绪的平台账号才允许同步店铺商品。",
                ) | {
                    "connector": connector,
                    "operation_details": connector.get("operation_details", []),
                    "next_action": connector.get("next_action") or "完成官方应用、回调地址、测试店铺授权和商品 API 适配后再同步。",
                },
            )
        log = await service.sync_products_for_account(account)
        await record_audit_event(
            db,
            user=current_user,
            action="product_sync_trigger",
            resource_type="platform_account",
            resource_id=account.id,
            new_value=_sync_result_payload(log),
            detail="手工触发平台店铺商品同步",
        )
        return ApiResponse(data=_sync_result_payload(log))

    store_ids = await list_accessible_store_ids(db, current_user)
    result = await db.execute(select(PlatformAccount).where(PlatformAccount.id.in_(store_ids), PlatformAccount.is_active == True))
    accounts = list(result.scalars().all())
    if not accounts:
        return evidence_response(data_required(
            "当前没有可同步的平台账号",
            data_gaps=["platform_accounts"],
            evidence_window="当前用户平台账号配置",
        ))
    unavailable = [get_platform_connector_status(account) for account in accounts if not is_product_sync_ready(account)]
    if unavailable:
        accounts_by_id = {account.id: account for account in accounts}
        for connector in unavailable:
            blocked_account = accounts_by_id.get(connector["account_id"])
            if blocked_account:
                await service.record_blocked_sync(
                    blocked_account,
                    "products",
                    connector["message"],
                    [{"reason": "connector_not_ready", "connector": connector}],
                )
        await record_audit_event(
            db,
            user=current_user,
            action="product_sync_blocked",
            resource_type="platform_account",
            resource_id="all",
            new_value={"accounts": unavailable},
            detail="批量商品同步因部分平台账号未就绪被阻断",
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=configuration_required(
                "存在尚未接通真实商品 Open API 的平台账号",
                data_gaps=["platform_products_open_api", "platform_credentials"],
                source_refs=[source_ref("platform_account", item["account_id"]) for item in unavailable],
                evidence_window="当前用户平台账号配置",
                confidence_reason="商品同步只允许真实平台商品接口就绪的店铺执行；未接入前不生成模拟商品。",
            ) | {
                "accounts": unavailable,
                "next_action": "逐个店铺补齐官方应用参数、回调地址、测试店铺授权，并完成商品 API 适配后再批量同步。",
            },
        )
    logs = await service.sync_all_products(account_ids=store_ids)
    await record_audit_event(
        db,
        user=current_user,
        action="product_sync_trigger",
        resource_type="platform_account",
        resource_id="all",
        new_value={"logs": [_sync_result_payload(log) for log in logs]},
        detail="手工触发全部平台店铺商品同步",
    )
    return ApiResponse(data=[_sync_result_payload(log) for log in logs])


@router.get("/logs", response_model=ApiResponse)
async def sync_logs(
    platform_account_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    store_ids = await list_accessible_store_ids(db, current_user)
    query = select(SyncLog).join(
        PlatformAccount,
        SyncLog.platform_account_id == PlatformAccount.id,
    ).where(
        PlatformAccount.id.in_(store_ids),
    )

    if platform_account_id:
        if platform_account_id not in store_ids:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform account not found")
        query = query.where(SyncLog.platform_account_id == platform_account_id)

    query = query.order_by(SyncLog.started_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    logs = list(result.scalars().all())

    data = [{
        "id": l.id,
        "platform_account_id": l.platform_account_id,
        "sync_type": l.sync_type,
        "status": l.status,
        "started_at": l.started_at.isoformat() if l.started_at else None,
        "completed_at": l.completed_at.isoformat() if l.completed_at else None,
        "records_processed": l.records_processed,
        "records_created": l.records_created,
        "records_updated": l.records_updated,
        "records_failed": l.records_failed,
        "error_message": l.error_message,
    } for l in logs]
    gaps = [] if logs else ["当前筛选下暂无平台同步日志"]
    failed = sum((item["records_failed"] or 0) for item in data)
    if failed:
        gaps.append(f"当前页共有 {failed} 条记录同步失败")
    return ApiResponse(
        data=data,
        status="ready" if logs else "data_required",
        source_refs=[source_ref("sync_log", item.id, label=item.sync_type) for item in logs],
        evidence_window=f"当前筛选第 {page} 页同步日志",
        confidence_reason="同步状态与计数直接来自真实连接器执行日志。",
        data_gaps=gaps,
    )


def _sync_result_payload(log: SyncLog) -> dict:
    gaps = []
    if log.records_failed:
        gaps.append(f"{log.records_failed} 条订单处理失败")
    return {
        "account_id": log.platform_account_id,
        "sync_log_id": log.id,
        "status": log.status,
        "records_processed": log.records_processed,
        "records_created": log.records_created,
        "records_updated": log.records_updated,
        "records_failed": log.records_failed,
        "error_message": log.error_message,
        **evidence_payload(
            source_refs=[
                source_ref("platform_account", log.platform_account_id),
                source_ref("sync_log", log.id),
            ],
            evidence_window=(
                f"{log.started_at.isoformat()} 至 {log.completed_at.isoformat()}"
                if log.started_at and log.completed_at
                else "当前同步任务"
            ),
            confidence_reason="同步结果来自真实平台连接器执行日志和实际写入计数。",
            data_gaps=gaps,
        ),
    }
